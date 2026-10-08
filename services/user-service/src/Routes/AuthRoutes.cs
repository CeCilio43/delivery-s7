using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Delivery.Common.Http;
using Microsoft.EntityFrameworkCore;
using UserService.Auth;
using UserService.Data;

namespace UserService.Routes;

public static partial class AuthRoutes
{
    private const int MinPasswordLength = 8;

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();

    public static void MapAuthRoutes(this IEndpointRouteBuilder app)
    {
        // Customers sign up from the customer-app.
        app.MapPost("/register", (HttpRequest request, UserDb db, Tokens tokens) =>
            Register(request, db, tokens, Role.Customer));

        // Restaurant owners sign up from the restaurant-app, then register their
        // restaurant there. Only these two roles can be self-assigned; couriers and
        // admins can't sign themselves up.
        app.MapPost("/register/restaurant-owner", (HttpRequest request, UserDb db, Tokens tokens) =>
            Register(request, db, tokens, Role.RestaurantOwner));

        app.MapPost("/login", Login);

        app.MapGet("/auth/google", (GoogleOAuth google) =>
            google.IsConfigured ? Results.Redirect(google.AuthorizationUrl()) : GoogleNotConfigured());

        app.MapGet("/auth/google/callback", GoogleCallback);
    }

    /// <summary>Creates an account with <paramref name="role"/> and signs it straight in.</summary>
    private static async Task<IResult> Register(HttpRequest request, UserDb db, Tokens tokens, Role role)
    {
        var body = await JsonBody.ReadAsync(request) as JsonObject;
        var email = body?["email"];
        var password = body?["password"];
        var name = body?["name"];

        if (IsFalsy(email) || IsFalsy(password))
        {
            return Error(StatusCodes.Status400BadRequest, "email and password are required");
        }
        if (email.AsString() is not { } emailText || !EmailPattern().IsMatch(emailText))
        {
            return Error(StatusCodes.Status400BadRequest, "Enter a valid email address");
        }
        if (password.AsString() is not { } passwordText || passwordText.Length < MinPasswordLength)
        {
            return Error(StatusCodes.Status400BadRequest, $"Password must be at least {MinPasswordLength} characters");
        }
        if (body!.ContainsKey("name") && name.AsString() is null)
        {
            return Error(StatusCodes.Status400BadRequest, "name must be a string");
        }

        if (await db.Users.AnyAsync(u => u.Email == emailText))
        {
            return Error(StatusCodes.Status409Conflict, "A user with that email already exists");
        }

        var trimmedName = name.AsString()?.Trim();
        var user = new User
        {
            Email = emailText,
            PasswordHash = Passwords.Hash(passwordText),
            Name = string.IsNullOrEmpty(trimmedName) ? null : trimmedName,
            Role = role,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Results.Json(SignedIn(user, tokens), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> Login(HttpRequest request, UserDb db, Tokens tokens)
    {
        var body = await JsonBody.ReadAsync(request) as JsonObject;
        var email = body?["email"];
        var password = body?["password"];

        if (IsFalsy(email) || IsFalsy(password))
        {
            return Error(StatusCodes.Status400BadRequest, "email and password are required");
        }

        var emailText = email.AsString();
        var user = emailText is null ? null : await db.Users.SingleOrDefaultAsync(u => u.Email == emailText);
        if (user is null)
        {
            return Error(StatusCodes.Status401Unauthorized, "Invalid email or password");
        }

        if (user.PasswordHash is null)
        {
            return Error(StatusCodes.Status400BadRequest, "This account uses Google sign-in. Please log in with Google instead.");
        }

        if (password.AsString() is not { } passwordText || !Passwords.Verify(passwordText, user.PasswordHash))
        {
            return Error(StatusCodes.Status401Unauthorized, "Invalid email or password");
        }

        return Results.Ok(SignedIn(user, tokens));
    }

    private static async Task<IResult> GoogleCallback(
        HttpRequest request, GoogleOAuth google, UserDb db, Tokens tokens, IConfiguration configuration, CancellationToken cancellationToken)
    {
        if (!google.IsConfigured) return GoogleNotConfigured();

        // The user declined on Google's consent page.
        if (request.Query.ContainsKey("error")) return Results.Redirect("/login-failed");

        var code = request.Query["code"].ToString();
        if (code.Length == 0) return Results.Redirect(google.AuthorizationUrl());

        var profile = await google.FetchProfileAsync(code, cancellationToken);

        var user = await db.Users.FirstOrDefaultAsync(u => u.GoogleId == profile.Id || u.Email == profile.Email, cancellationToken);
        if (user is null)
        {
            user = new User { GoogleId = profile.Id, Email = profile.Email, Name = profile.Name, Role = Role.Customer };
            db.Users.Add(user);
            await db.SaveChangesAsync(cancellationToken);
        }
        else if (user.GoogleId is null)
        {
            // Existing email/password account signing in with Google for the first time.
            user.GoogleId = profile.Id;
            await db.SaveChangesAsync(cancellationToken);
        }

        var frontendUrl = configuration["FRONTEND_URL"] ?? "http://localhost:5173";
        return Results.Redirect($"{frontendUrl}/auth/callback?token={tokens.Sign(user)}");
    }

    private static object SignedIn(User user, Tokens tokens) => new
    {
        token = tokens.Sign(user),
        user = new { id = user.Id, email = user.Email, name = user.Name, role = user.Role },
    };

    /// <summary>What JavaScript treats as false: missing, null, "", 0 or false.</summary>
    private static bool IsFalsy(JsonNode? node) =>
        node is null || node.GetValueKind() switch
        {
            JsonValueKind.False => true,
            JsonValueKind.String => node.GetValue<string>().Length == 0,
            JsonValueKind.Number => node.GetValue<decimal>() == 0,
            _ => false,
        };

    private static IResult GoogleNotConfigured() =>
        Error(StatusCodes.Status503ServiceUnavailable,
            "Google sign-in is not configured (set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL)");

    private static IResult Error(int status, string message) => Results.Json(new { error = message }, statusCode: status);
}
