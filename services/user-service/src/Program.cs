using Delivery.Common;
using Delivery.Common.Data;
using Delivery.Common.Http;
using UserService;
using UserService.Auth;
using UserService.Data;
using UserService.Routes;

DotEnv.Load();

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddPrismaDatabase<UserDb>(npgsql => npgsql.MapPrismaEnum<Role>());
builder.Services.AddSingleton<Tokens>();
builder.Services.AddHttpClient<GoogleOAuth>();

var app = builder.Build();

await app.Services.MigrateAsync<UserDb>();
if (args.Contains("seed"))
{
    await Seed.RunAsync(app.Services);
    return;
}

if (!app.Services.GetRequiredService<GoogleOAuth>().IsConfigured)
{
    app.Logger.LogWarning(
        "Google OAuth is not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_CALLBACK_URL) — " +
        "/auth/google and /auth/google/callback will be unavailable until these are set.");
}

app.UseServiceDefaults("user-service");
app.MapAuthRoutes();

app.Run();

public partial class Program;
