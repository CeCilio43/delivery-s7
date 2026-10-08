using Delivery.Common.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Delivery.Common.Http;

public static class ServiceDefaults
{
    /// <summary>Listens on PORT (default 3000) and uses the frontends' JSON format.</summary>
    public static WebApplicationBuilder AddServiceDefaults(this WebApplicationBuilder builder)
    {
        var port = builder.Configuration["PORT"] ?? "3000";
        builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
        builder.Services.ConfigureHttpJsonOptions(options => ApiJson.Configure(options.SerializerOptions));
        return builder;
    }

    /// <summary>Turns malformed request bodies into a 400 and serves GET /health.</summary>
    public static WebApplication UseServiceDefaults(this WebApplication app, string serviceName)
    {
        app.Use(async (context, next) =>
        {
            try
            {
                await next(context);
            }
            catch (BadHttpRequestException ex) when (!context.Response.HasStarted)
            {
                context.Response.StatusCode = ex.StatusCode;
                await context.Response.WriteAsJsonAsync(new { error = ex.Message });
            }
        });

        app.MapGet("/health", () => new { status = "ok", service = serviceName });
        return app;
    }
}
