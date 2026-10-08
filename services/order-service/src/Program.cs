using Delivery.Common;
using Delivery.Common.Data;
using Delivery.Common.Http;
using OrderService;
using OrderService.Data;
using OrderService.Events;
using OrderService.Routes;

DotEnv.Load();

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddPrismaDatabase<OrderDb>(npgsql => npgsql.MapPrismaEnum<OrderStatus>());
builder.Services.AddRabbitMqEventBus();
builder.Services.AddScoped<OrderEvents>();
builder.Services.AddHostedService<Subscriptions>();
builder.Services.AddHttpClient<RestaurantClient>(http =>
    http.BaseAddress = new Uri($"{(builder.Configuration["RESTAURANT_SERVICE_URL"] ?? "http://localhost:3002").TrimEnd('/')}/"));

var app = builder.Build();

await app.Services.MigrateAsync<OrderDb>();
if (args.Contains("seed"))
{
    await Seed.RunAsync(app.Services);
    return;
}

app.UseServiceDefaults("order-service");
app.MapOrderRoutes();
app.MapOwnerRoutes();

app.Run();

public partial class Program;
