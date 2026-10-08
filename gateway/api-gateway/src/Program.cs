using ApiGateway;
using Delivery.Common;
using Delivery.Common.Http;

DotEnv.Load();

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();

// The frontends run on other origins (customer-app on 5173, restaurant-app
// on 5174 in development) and send an Authorization header on protected
// requests, both of which trigger a CORS preflight that the browser blocks
// without this. FRONTEND_URLS is a comma-separated list of allowed origins.
var frontendUrls = (builder.Configuration["FRONTEND_URLS"] ?? "http://localhost:5173,http://localhost:5174")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(cors => cors.AddDefaultPolicy(policy =>
    policy.WithOrigins(frontendUrls).AllowAnyHeader().AllowAnyMethod()));

builder.Services
    .AddReverseProxy()
    .LoadFromMemory(GatewayRoutes.Routes(), GatewayRoutes.Clusters(builder.Configuration))
    .AddTransforms(GatewayAuth.AddIdentityTransforms);

var openApiSpec = OpenApiSpec.Load(Path.Combine(AppContext.BaseDirectory, "openapi.yaml"));

var app = builder.Build();

app.UseCors();
app.UseIdentityHeaderStripping();
app.UseServiceDefaults("api-gateway");

// Swagger UI for trying out every route the gateway exposes. Served from the
// gateway itself so "Try it out" requests are same-origin and go through the
// exact same proxying and auth as the frontends'.
app.MapGet("/openapi.json", () => Results.Json(openApiSpec));
app.UseSwaggerUI(swagger =>
{
    swagger.RoutePrefix = "docs";
    swagger.SwaggerEndpoint("/openapi.json", "Food Delivery API");
    swagger.EnablePersistAuthorization();
});

app.UseRouting();
app.UseGatewayAuth();
app.MapReverseProxy();

app.Run();

public partial class Program;
