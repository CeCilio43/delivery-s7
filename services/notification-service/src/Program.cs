using Delivery.Common;
using Delivery.Common.Http;
using NotificationService;

DotEnv.Load();

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddRabbitMqEventBus();
builder.Services.AddSingleton<NotificationHub>();
builder.Services.AddSingleton<INotificationSender>(provider => provider.GetRequiredService<NotificationHub>());
builder.Services.AddHostedService<Subscriptions>();

var app = builder.Build();

app.UseServiceDefaults("notification-service");
app.UseWebSockets();
app.Map(NotificationHub.Path, (HttpContext context, NotificationHub hub) => hub.AcceptAsync(context));

app.Run();

public partial class Program;
