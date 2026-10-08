using Microsoft.EntityFrameworkCore;
using UserService.Auth;
using UserService.Data;

namespace UserService;

/// <summary>Development data; run with `dotnet run -- seed`.</summary>
public static class Seed
{
    // Known dev password for every seeded user, so they're usable for local login testing.
    private const string DevPassword = "password123";

    public static async Task RunAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<UserDb>();

        (string Id, string Email, string Name, Role Role)[] users =
        [
            ("11111111-1111-1111-1111-111111111111", "jamie@example.com", "Jamie Customer", Role.Customer),
            ("11111111-1111-1111-1111-111111111112", "alex@example.com", "Alex Customer", Role.Customer),
            ("11111111-1111-1111-1111-111111111113", "riley@example.com", "Riley Customer", Role.Customer),
            ("22222222-2222-2222-2222-222222222221", "sam@mariospizzeria.com", "Sam Owner", Role.RestaurantOwner),
            ("22222222-2222-2222-2222-222222222222", "priya@spiceroute.com", "Priya Owner", Role.RestaurantOwner),
            ("22222222-2222-2222-2222-222222222223", "chen@goldenwok.com", "Chen Owner", Role.RestaurantOwner),
        ];

        var passwordHash = Passwords.Hash(DevPassword);
        foreach (var (id, email, name, role) in users)
        {
            var user = await db.Users.FindAsync(id);
            if (user is null)
            {
                db.Users.Add(new User { Id = id, Email = email, Name = name, Role = role, PasswordHash = passwordHash });
            }
            else
            {
                user.PasswordHash = passwordHash;
            }
        }
        await db.SaveChangesAsync();

        Console.WriteLine($"user-service seeded: {users.Length} users. Password for all seeded users: \"{DevPassword}\"");
    }
}
