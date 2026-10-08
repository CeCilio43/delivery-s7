using Delivery.Common.Json;

namespace OrderService;

public record RestaurantMenu(string Id, bool IsOpen, List<RestaurantMenuItem> MenuItems);

public record RestaurantMenuItem(string Id, string Name, decimal Price, bool IsAvailable);

/// <summary>
/// Reads restaurants and menus from restaurant-service. Prices and names come
/// from here rather than the request body, so a client can't choose what it
/// pays for an item.
/// </summary>
public class RestaurantClient(HttpClient http)
{
    /// <summary>The restaurant with its menu, or null if restaurant-service doesn't know it.</summary>
    public async Task<RestaurantMenu?> GetMenuAsync(string restaurantId, CancellationToken cancellationToken = default)
    {
        using var response = await http.GetAsync($"restaurants/{Uri.EscapeDataString(restaurantId)}", cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"restaurant-service responded with {(int)response.StatusCode}");
        }
        return await response.Content.ReadFromJsonAsync<RestaurantMenu>(ApiJson.Options, cancellationToken);
    }
}
