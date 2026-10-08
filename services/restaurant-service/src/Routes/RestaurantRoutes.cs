using Microsoft.EntityFrameworkCore;
using RestaurantService.Data;

namespace RestaurantService.Routes;

/// <summary>Browsing restaurants and menus is public; no auth required on these routes.</summary>
public static class RestaurantRoutes
{
    public static void MapRestaurantRoutes(this IEndpointRouteBuilder app)
    {
        app.MapGet("/restaurants", async (string? search, RestaurantDb db) =>
        {
            var query = db.Restaurants.AsQueryable();
            var term = search?.Trim().ToLowerInvariant();
            if (!string.IsNullOrEmpty(term))
            {
                query = query.Where(r => r.Name.ToLower().Contains(term) || (r.Cuisine != null && r.Cuisine.ToLower().Contains(term)));
            }

            return await query
                .Select(r => new { r.Id, r.Name, r.Cuisine, r.Address, r.IsOpen })
                .ToListAsync();
        });

        app.MapGet("/restaurants/{id}", async (string id, RestaurantDb db) =>
        {
            var restaurant = await db.Restaurants.Include(r => r.MenuItems).FirstOrDefaultAsync(r => r.Id == id);
            return restaurant is null
                ? Results.Json(new { error = "Restaurant not found" }, statusCode: StatusCodes.Status404NotFound)
                : Results.Ok(restaurant);
        });
    }
}
