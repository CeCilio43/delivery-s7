using Delivery.Common;
using Delivery.Common.Data;
using Delivery.Common.Http;
using PaymentService;
using PaymentService.Data;
using PaymentService.Events;
using PaymentService.Routes;

DotEnv.Load();

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddPrismaDatabase<PaymentDb>(npgsql => npgsql.MapPrismaEnum<PaymentStatus>());
builder.Services.AddRabbitMqEventBus();
builder.Services.AddScoped<MockPaymentProvider>();
builder.Services.AddHostedService<Subscriptions>();

var app = builder.Build();

await app.Services.MigrateAsync<PaymentDb>();
if (args.Contains("seed"))
{
    await Seed.RunAsync(app.Services);
    return;
}

app.UseServiceDefaults("payment-service");
app.MapPaymentRoutes();

app.Run();

public partial class Program;
