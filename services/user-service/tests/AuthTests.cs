using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Delivery.Common.Auth;
using Delivery.Testing;
using Microsoft.EntityFrameworkCore;
using UserService.Auth;
using UserService.Data;

namespace UserService.Tests;

public sealed class AuthTests : IDisposable
{
    private readonly DbServiceFactory<Program, UserDb> _factory = new();
    private readonly HttpClient _client;

    public AuthTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static JsonElement Claims(JsonElement body) =>
        JsonSerializer.SerializeToElement(Jwt.Verify(body.GetProperty("token").GetString()!, ServiceFactory<Program>.JwtSecret));

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("""{"status":"ok","service":"user-service"}""", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Register_CreatesACustomerAndReturnsAToken()
    {
        var response = await _client.PostAsJsonAsync("/register", new { email = "new@example.com", password = "secret123", name = "New User" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await Json(response);
        var user = body.GetProperty("user");
        Assert.Equal("new@example.com", user.GetProperty("email").GetString());
        Assert.Equal("New User", user.GetProperty("name").GetString());
        Assert.Equal("CUSTOMER", user.GetProperty("role").GetString());
        Assert.Equal(["id", "email", "name", "role"], user.EnumerateObject().Select(p => p.Name));
        Assert.Equal(user.GetProperty("id").GetString(), Claims(body).GetProperty("sub").GetString());
    }

    [Fact]
    public async Task Register_RejectsADuplicateEmail()
    {
        await _factory.Seed(new User { Email = "dup@example.com" });

        var response = await _client.PostAsJsonAsync("/register", new { email = "dup@example.com", password = "secret123", name = "Dup" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(1, await _factory.WithDb(db => db.Users.CountAsync()));
    }

    [Theory]
    [InlineData("""{"email":"not-an-email","password":"secret123"}""", "Enter a valid email address")]
    [InlineData("""{"email":"new@example.com","password":"short"}""", "Password must be at least 8 characters")]
    [InlineData("""{"email":"new@example.com"}""", "email and password are required")]
    [InlineData("""{"email":"new@example.com","password":"secret123","name":5}""", "name must be a string")]
    public async Task Register_ValidatesTheBody(string json, string error)
    {
        var response = await _client.PostAsync("/register", new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(error, (await Json(response)).GetProperty("error").GetString());
        Assert.Equal(0, await _factory.WithDb(db => db.Users.CountAsync()));
    }

    [Fact]
    public async Task RegisterRestaurantOwner_CreatesAnOwnerAndSignsThemIn()
    {
        var response = await _client.PostAsJsonAsync("/register/restaurant-owner", new { email = "chef@pastacorner.com", password = "secret123", name = " Chef " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var stored = await _factory.WithDb(db => db.Users.SingleAsync());
        Assert.Equal("Chef", stored.Name);
        Assert.Equal(Role.RestaurantOwner, stored.Role);
        Assert.True(Passwords.Verify("secret123", stored.PasswordHash!));

        var claims = Claims(await Json(response));
        Assert.Equal(stored.Id, claims.GetProperty("sub").GetString());
        Assert.Equal("RESTAURANT_OWNER", claims.GetProperty("role").GetString());
        Assert.Equal("chef@pastacorner.com", claims.GetProperty("email").GetString());
    }

    [Fact]
    public async Task RegisterRestaurantOwner_IgnoresAnyRoleInTheBody()
    {
        await _client.PostAsJsonAsync("/register/restaurant-owner", new { email = "chef@pastacorner.com", password = "secret123", role = "ADMIN" });

        Assert.Equal(Role.RestaurantOwner, (await _factory.WithDb(db => db.Users.SingleAsync())).Role);
    }

    [Fact]
    public async Task Login_ReturnsATokenForCorrectCredentials()
    {
        await _factory.Seed(new User
        {
            Id = "user-2",
            Email = "login@example.com",
            Name = "Login User",
            PasswordHash = Passwords.Hash("correct-password"),
        });

        var response = await _client.PostAsJsonAsync("/login", new { email = "login@example.com", password = "correct-password" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await Json(response);
        Assert.Equal(
            """{"id":"user-2","email":"login@example.com","name":"Login User","role":"CUSTOMER"}""",
            body.GetProperty("user").GetRawText());
        // The customer-app reads the email from the token to show who's logged in.
        var claims = Claims(body);
        Assert.Equal("user-2", claims.GetProperty("sub").GetString());
        Assert.Equal("CUSTOMER", claims.GetProperty("role").GetString());
        Assert.Equal("login@example.com", claims.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Login_Returns401ForTheWrongPassword()
    {
        await _factory.Seed(new User { Email = "wrongpass@example.com", PasswordHash = Passwords.Hash("correct-password") });

        var response = await _client.PostAsJsonAsync("/login", new { email = "wrongpass@example.com", password = "incorrect-password" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_ReturnsAClear400ForAGoogleOnlyAccount()
    {
        await _factory.Seed(new User { Email = "google@example.com", GoogleId = "google-sub-123" });

        var response = await _client.PostAsJsonAsync("/login", new { email = "google@example.com", password = "whatever" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("google", (await Json(response)).GetProperty("error").GetString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Login_AcceptsPasswordsHashedByTheNodeService()
    {
        // "password123", hashed by the Node service's bcrypt package.
        await _factory.Seed(new User { Email = "jamie@example.com", PasswordHash = "$2b$10$afeFHdEBbYXTg.1H15EvSOnd7922SXttNs9XDcdyZ7qFPG7llZ8KO" });

        var response = await _client.PostAsJsonAsync("/login", new { email = "jamie@example.com", password = "password123" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
