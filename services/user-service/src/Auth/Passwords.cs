namespace UserService.Auth;

/// <summary>bcrypt, compatible with the hashes the Node service stored.</summary>
public static class Passwords
{
    private const int WorkFactor = 10;

    public static string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    public static bool Verify(string password, string hash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // Not a bcrypt hash at all, so no password can match it.
            return false;
        }
    }
}
