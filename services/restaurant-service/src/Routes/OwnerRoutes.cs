using Delivery.Common.Http;
using Microsoft.EntityFrameworkCore;
using RestaurantService.Data;
using RestaurantService.Events;

namespace RestaurantService.Routes;

/// <summary>
/// Everything a restaurant owner manages: their restaurants' details, whether
/// they're open, and their menus. Reached through the api-gateway at
/// /owner/restaurants, which only lets RESTAURANT_OWNER tokens through.
/// </summary>
public static class OwnerRoutes
{
    public static void MapOwnerRoutes(this IEndpointRouteBuilder app)
    {
        var owner = app.MapGroup("/owner/restaurants").RequireOwner();

        owner.MapGet("", async (HttpContext context, RestaurantDb db) =>
            await WithMenu(db).Where(r => r.OwnerId == context.UserId()).OrderBy(r => r.CreatedAt).ToListAsync());

        owner.MapPost("", async (HttpContext context, RestaurantDb db, RestaurantEvents events) =>
        {
            if (Validation.ParseNewRestaurant(await JsonBody.ReadAsync(context.Request), out var input) is { } error) return BadRequest(error);

            // New restaurants start closed, so customers can't order before the
            // owner has set up a menu and opened up.
            var restaurant = new Restaurant
            {
                OwnerId = context.UserId(),
                Name = input.Name,
                Address = input.Address,
                Cuisine = input.Cuisine,
                Description = input.Description,
                IsOpen = false,
            };
            db.Restaurants.Add(restaurant);
            await db.SaveChangesAsync();

            await events.PublishSafelyAsync(() => events.PublishCreatedAsync(restaurant));
            return Results.Json(restaurant, statusCode: StatusCodes.Status201Created);
        });

        owner.MapGet("/{id}", async (string id, HttpContext context, RestaurantDb db) =>
        {
            if (await FindOwnedAsync(db, id, context.UserId()) is null) return RestaurantNotFound();
            return Results.Ok(await WithMenu(db).SingleAsync(r => r.Id == id));
        });

        owner.MapPatch("/{id}", async (string id, HttpContext context, RestaurantDb db, RestaurantEvents events) =>
        {
            if (Validation.ParseRestaurantUpdate(await JsonBody.ReadAsync(context.Request), out var apply) is { } error) return BadRequest(error);

            var restaurant = await FindOwnedAsync(db, id, context.UserId());
            if (restaurant is null) return RestaurantNotFound();

            apply(restaurant);
            await db.SaveChangesAsync();

            var updated = await WithMenu(db).SingleAsync(r => r.Id == id);
            await events.PublishSafelyAsync(() => events.PublishUpdatedAsync(updated));
            return Results.Ok(updated);
        });

        owner.MapPost("/{id}/menu-items", async (string id, HttpContext context, RestaurantDb db) =>
        {
            if (Validation.ParseNewMenuItem(await JsonBody.ReadAsync(context.Request), out var input) is { } error) return BadRequest(error);

            if (await FindOwnedAsync(db, id, context.UserId()) is null) return RestaurantNotFound();

            var menuItem = new MenuItem
            {
                RestaurantId = id,
                Name = input.Name,
                Description = input.Description,
                Price = input.Price,
                IsAvailable = input.IsAvailable,
            };
            db.MenuItems.Add(menuItem);
            await db.SaveChangesAsync();
            return Results.Json(menuItem, statusCode: StatusCodes.Status201Created);
        });

        owner.MapPatch("/{id}/menu-items/{itemId}", async (string id, string itemId, HttpContext context, RestaurantDb db) =>
        {
            if (Validation.ParseMenuItemUpdate(await JsonBody.ReadAsync(context.Request), out var apply) is { } error) return BadRequest(error);

            if (await FindOwnedAsync(db, id, context.UserId()) is null) return RestaurantNotFound();

            var menuItem = await db.MenuItems.FirstOrDefaultAsync(i => i.Id == itemId && i.RestaurantId == id);
            if (menuItem is null) return MenuItemNotFound();

            apply(menuItem);
            await db.SaveChangesAsync();
            return Results.Ok(menuItem);
        });

        // Past orders keep their own copy of each item's name and price, so deleting
        // a menu item never changes an existing order.
        owner.MapDelete("/{id}/menu-items/{itemId}", async (string id, string itemId, HttpContext context, RestaurantDb db) =>
        {
            if (await FindOwnedAsync(db, id, context.UserId()) is null) return RestaurantNotFound();

            var deleted = await db.MenuItems.Where(i => i.Id == itemId && i.RestaurantId == id).ExecuteDeleteAsync();
            return deleted == 0 ? MenuItemNotFound() : Results.NoContent();
        });
    }

    private static IQueryable<Restaurant> WithMenu(RestaurantDb db) =>
        db.Restaurants.Include(r => r.MenuItems.OrderBy(i => i.CreatedAt));

    /// <summary>The restaurant with this id if the caller owns it.</summary>
    // Someone else's restaurant is a 404 rather than a 403, so ids can't be probed.
    private static Task<Restaurant?> FindOwnedAsync(RestaurantDb db, string id, string ownerId) =>
        db.Restaurants.FirstOrDefaultAsync(r => r.Id == id && r.OwnerId == ownerId);

    private static IResult BadRequest(string error) => Results.BadRequest(new { error });

    private static IResult RestaurantNotFound() => Results.NotFound(new { error = "Restaurant not found" });

    private static IResult MenuItemNotFound() => Results.NotFound(new { error = "Menu item not found" });
}
