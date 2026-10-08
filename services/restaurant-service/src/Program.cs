using Delivery.Common;
using Delivery.Common.Data;
using Delivery.Common.Http;
using RestaurantService;
using RestaurantService.Data;
using RestaurantService.Events;
using RestaurantService.Routes;

DotEnv.Load();

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddPrismaDatabase<RestaurantDb>();
builder.Services.AddRabbitMqEventBus();
builder.Services.AddSingleton<RestaurantEvents>();
builder.Services.AddHostedService<Subscriptions>();

var app = builder.Build();

await app.Services.MigrateAsync<RestaurantDb>();
if (args.Contains("seed"))
{
    await Seed.RunAsync(app.Services);
    return;
}

app.UseServiceDefaults("restaurant-service");
app.MapRestaurantRoutes();
app.MapOwnerRoutes();

app.Run();

public partial class Program;
