using System.Text.Json.Serialization;
using Microsoft.AspNetCore.WebUtilities;

namespace UserService.Auth;

/// <summary>The profile Google returns for a signed-in user.</summary>
public record GoogleProfile(string Id, string Email, string? Name);

/// <summary>
/// Google's OAuth 2.0 authorization-code flow ("Sign in with Google").
/// Only usable once GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
/// GOOGLE_CALLBACK_URL are set; until then /auth/google reports that it
/// isn't configured instead of the whole service failing to start.
/// </summary>
public class GoogleOAuth(HttpClient http, IConfiguration configuration)
{
    private const string AuthorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    private const string TokenUrl = "https://oauth2.googleapis.com/token";
    private const string UserInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo";

    private string? ClientId => configuration["GOOGLE_CLIENT_ID"];
    private string? ClientSecret => configuration["GOOGLE_CLIENT_SECRET"];
    private string? CallbackUrl => configuration["GOOGLE_CALLBACK_URL"];

    public bool IsConfigured =>
        !string.IsNullOrEmpty(ClientId) && !string.IsNullOrEmpty(ClientSecret) && !string.IsNullOrEmpty(CallbackUrl);

    /// <summary>Google's consent page, which redirects back to GOOGLE_CALLBACK_URL with a code.</summary>
    public string AuthorizationUrl() =>
        QueryHelpers.AddQueryString(AuthorizeUrl, new Dictionary<string, string?>
        {
            ["response_type"] = "code",
            ["client_id"] = ClientId,
            ["redirect_uri"] = CallbackUrl,
            ["scope"] = "profile email",
        });

    /// <summary>Exchanges the callback's code for the user's Google profile.</summary>
    public async Task<GoogleProfile> FetchProfileAsync(string code, CancellationToken cancellationToken)
    {
        using var tokenResponse = await http.PostAsync(TokenUrl, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = ClientId!,
            ["client_secret"] = ClientSecret!,
            ["redirect_uri"] = CallbackUrl!,
            ["grant_type"] = "authorization_code",
        }), cancellationToken);
        tokenResponse.EnsureSuccessStatusCode();
        var token = await tokenResponse.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken)
            ?? throw new InvalidOperationException("Google returned no access token");

        using var request = new HttpRequestMessage(HttpMethod.Get, UserInfoUrl);
        request.Headers.Authorization = new("Bearer", token.AccessToken);
        using var userInfoResponse = await http.SendAsync(request, cancellationToken);
        userInfoResponse.EnsureSuccessStatusCode();
        var userInfo = await userInfoResponse.Content.ReadFromJsonAsync<UserInfo>(cancellationToken)
            ?? throw new InvalidOperationException("Google returned no profile");

        if (string.IsNullOrEmpty(userInfo.Email))
        {
            throw new InvalidOperationException("Google profile did not include an email address");
        }
        return new GoogleProfile(userInfo.Sub, userInfo.Email, userInfo.Name);
    }

    private record TokenResponse([property: JsonPropertyName("access_token")] string AccessToken);

    private record UserInfo(string Sub, string? Email, string? Name);
}
