using Npgsql;

namespace Delivery.Common.Data;

public static class PostgresUrl
{
    /// <summary>
    /// Turns a DATABASE_URL such as
    /// postgresql://postgres:postgres@localhost:5432/order_service_db?schema=public
    /// into an Npgsql connection string.
    /// </summary>
    public static string ToConnectionString(string url)
    {
        var uri = new Uri(url);
        var credentials = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(credentials[0]),
            // Skips probing for Kerberos (GSS) encryption, which the slim .NET
            // images can't do and would log an error about on every start.
            GssEncryptionMode = GssEncryptionMode.Disable,
        };
        if (credentials.Length > 1) builder.Password = Uri.UnescapeDataString(credentials[1]);

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts[0] == "schema" && parts.Length == 2) builder.SearchPath = Uri.UnescapeDataString(parts[1]);
        }

        return builder.ConnectionString;
    }
}
