namespace Inventory.Tests.E2E.Infrastructure;

using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

public sealed partial class PlaywrightFixture : IAsyncLifetime
{
    private static readonly bool Headless =
        !string.Equals(Environment.GetEnvironmentVariable("PLAYWRIGHT_HEADED"), "1", StringComparison.OrdinalIgnoreCase);

    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private string? _baseAddress;

    public PlaywrightFixture()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("DefaultAzureCredentialOptions__CredentialProcessTimeout")))
        {
            Environment.SetEnvironmentVariable(
                "DefaultAzureCredentialOptions__CredentialProcessTimeout",
                "00:03:00");
        }

        Factory = new InventoryWebApplicationFactory();
        ChatStore = new InMemoryChatsStore();
        ProductStore = new InMemoryProductsStore();
        CatalogStore = new InMemoryCatalogStore();
    }

    public InventoryWebApplicationFactory Factory { get; }

    public InMemoryChatsStore ChatStore { get; }

    public InMemoryProductsStore ProductStore { get; }

    public InMemoryCatalogStore CatalogStore { get; }

    public string BaseAddress =>
        _baseAddress ?? throw new InvalidOperationException("BaseAddress is not available until InitializeAsync has run.");

    public async ValueTask InitializeAsync()
    {
        await Factory.StartAsync();
        _baseAddress = Factory.ServerAddress;

        var exitCode = Microsoft.Playwright.Program.Main(["install", "chromium"]);
        if (exitCode != 0)
        {
            throw new InvalidOperationException($"Playwright install failed with exit code {exitCode}.");
        }

        _playwright = await Playwright.CreateAsync();
        _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = Headless
        });

        var warmup = await NewProductsPageAsync();
        await using (warmup.Context) { }
    }

    public async Task<(IAsyncDisposable Context, IPage Page)> NewProductsPageAsync()
    {
        if (_browser is null)
        {
            throw new InvalidOperationException("Browser is not initialized. Ensure InitializeAsync has been awaited.");
        }

        var (session, page) = await PlaywrightArtifactRecorder.CreateSessionAsync(_browser, "Inventory", "E2E", new BrowserNewContextOptions
        {
            BaseURL = BaseAddress,
            IgnoreHTTPSErrors = true
        });

        page.SetDefaultTimeout(60_000);

        await page.RouteAsync("**/bff/user", async route =>
        {
            await route.FulfillAsync(new RouteFulfillOptions
            {
                Status = 200,
                ContentType = "application/json",
                Body = JsonSerializer.Serialize(new object[]
                {
                    new { type = "sub", value = "e2e-user-id" },
                    new { type = "name", value = "E2E Test User" },
                    new { type = "email", value = "e2e@test.invalid" },
                    new { type = "sid", value = "e2e-session" },
                })
            });
        });

        await page.RouteAsync("**/products/api/**", async route =>
        {
            try
            {
                await DispatchProductsRouteAsync(route);
            }
            catch
            {
                await route.FulfillAsync(new RouteFulfillOptions { Status = 500 });
            }
        });

        await page.RouteAsync("**/manuals/api/**", async route =>
        {
            try
            {
                await DispatchManualsRouteAsync(route);
            }
            catch
            {
                await route.FulfillAsync(new RouteFulfillOptions { Status = 500 });
            }
        });

        await page.GotoAsync("/products", new PageGotoOptions
        {
            WaitUntil = WaitUntilState.DOMContentLoaded,
            Timeout = 60_000
        });

        await page.WaitForSelectorAsync("#products-empty-state, #products-table", new PageWaitForSelectorOptions
        {
            Timeout = 60_000
        });

        return (session, page);
    }

    public async Task<(IAsyncDisposable Context, IPage Page)> NewCatalogPageAsync()
    {
        if (_browser is null)
        {
            throw new InvalidOperationException("Browser is not initialized. Ensure InitializeAsync has been awaited.");
        }

        var (session, page) = await PlaywrightArtifactRecorder.CreateSessionAsync(_browser, "Inventory", "E2E", new BrowserNewContextOptions
        {
            BaseURL = BaseAddress,
            IgnoreHTTPSErrors = true,
        });
        page.SetDefaultTimeout(60_000);

        await page.RouteAsync("**/bff/user", async route =>
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 401 });
        });

        await page.RouteAsync("**/bff/login**", async route =>
        {
            await route.FulfillAsync(new RouteFulfillOptions
            {
                Status = 200,
                ContentType = "text/html",
                Body = """
                    <!doctype html>
                    <html><body>
                    <script>window.parent.postMessage({ source: 'bff-silent-login', isLoggedIn: false }, '*');</script>
                    </body></html>
                    """
            });
        });

        await page.RouteAsync("**/catalog/api/odata/**", async route =>
        {
            try
            {
                await DispatchCatalogRouteAsync(route);
            }
            catch
            {
                await route.FulfillAsync(new RouteFulfillOptions { Status = 500 });
            }
        });

        await page.GotoAsync("/catalog", new PageGotoOptions
        {
            WaitUntil = WaitUntilState.DOMContentLoaded,
            Timeout = 60_000
        });

        await page.WaitForSelectorAsync("#catalog-empty-state, #catalog-table", new PageWaitForSelectorOptions
        {
            Timeout = 60_000
        });

        return (session, page);
    }

    public async ValueTask DisposeAsync()
    {
        if (_browser is not null)
        {
            await _browser.DisposeAsync();
        }

        _playwright?.Dispose();
        await Factory.DisposeAsync();
    }

    private async Task DispatchCatalogRouteAsync(IRoute route)
    {
        var request = route.Request;
        var method = request.Method.ToUpperInvariant();
        var uri = new Uri(request.Url);

        var path = uri.AbsolutePath;
        var collectionIndex = path.LastIndexOf("/CatalogProducts", StringComparison.OrdinalIgnoreCase);
        if (collectionIndex < 0)
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
            return;
        }

        var remainder = path[(collectionIndex + "/CatalogProducts".Length)..];

        if (remainder.Length == 0 || string.Equals(remainder, "/", StringComparison.Ordinal))
        {
            if (string.Equals(method, "GET", StringComparison.Ordinal))
            {
                await HandleCatalogCollectionAsync(route, uri);
            }
            else
            {
                await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
            }
        }
        else if (remainder.StartsWith('(') && remainder.EndsWith(')'))
        {
            var idStr = remainder[1..^1];
            if (!Guid.TryParse(idStr, out var id))
            {
                await route.FulfillAsync(new RouteFulfillOptions { Status = 400 });
                return;
            }

            if (string.Equals(method, "GET", StringComparison.Ordinal))
            {
                var product = CatalogStore.GetProduct(id);
                if (product is null)
                {
                    await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
                    return;
                }

                await route.FulfillAsync(new RouteFulfillOptions
                {
                    Status = 200,
                    ContentType = "application/json",
                    Body = JsonSerializer.Serialize(CatalogRecordToJson(product))
                });
            }
            else
            {
                await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
            }
        }
        else
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
        }
    }

    private async Task HandleCatalogCollectionAsync(IRoute route, Uri uri)
    {
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);

        string? nameFilter = null;
        if (query.TryGetValue("$filter", out var fv))
        {
            var match = ODataFilterRegex().Match(fv.ToString());
            if (match.Success)
            {
                nameFilter = match.Groups[1].Value;
            }
        }

        var orderBy = "Name";
        var orderDesc = false;
        if (query.TryGetValue("$orderby", out var obv))
        {
            var parts = obv.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 1)
            {
                orderBy = parts[0];
            }

            if (parts.Length >= 2)
            {
                orderDesc = parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase);
            }
        }

        var top = int.MaxValue;
        var skip = 0;
        if (query.TryGetValue("$top", out var tv) && int.TryParse(tv.ToString(), out var topVal))
        {
            top = topVal;
        }

        if (query.TryGetValue("$skip", out var sv) && int.TryParse(sv.ToString(), out var skipVal))
        {
            skip = skipVal;
        }

        var includeCount = query.TryGetValue("$count", out var cv) &&
            cv.ToString().Equals("true", StringComparison.OrdinalIgnoreCase);

        var allProducts = CatalogStore.GetProducts(nameFilter);
        var totalCount = allProducts.Count;

        IEnumerable<InMemoryCatalogStore.CatalogRecord> ordered = orderBy switch
        {
            "MsrpPrice" when !orderDesc => allProducts.OrderBy(p => p.MsrpPrice),
            "MsrpPrice" => allProducts.OrderByDescending(p => p.MsrpPrice),
            "Brand" when !orderDesc => allProducts.OrderBy(p => p.Brand, StringComparer.Ordinal),
            "Brand" => allProducts.OrderByDescending(p => p.Brand, StringComparer.Ordinal),
            "Category" when !orderDesc => allProducts.OrderBy(p => p.Category, StringComparer.Ordinal),
            "Category" => allProducts.OrderByDescending(p => p.Category, StringComparer.Ordinal),
            _ when orderDesc => allProducts.OrderByDescending(p => p.Name, StringComparer.Ordinal),
            _ => allProducts.OrderBy(p => p.Name, StringComparer.Ordinal),
        };

        var pageItems = ordered.Skip(skip).Take(top).Select(CatalogRecordToJson).ToArray();

        var responseDict = new Dictionary<string, object?>
        {
            ["value"] = pageItems
        };
        if (includeCount)
        {
            responseDict["@odata.count"] = totalCount;
        }

        await route.FulfillAsync(new RouteFulfillOptions
        {
            Status = 200,
            ContentType = "application/json",
            Body = JsonSerializer.Serialize(responseDict)
        });
    }

    private static object CatalogRecordToJson(InMemoryCatalogStore.CatalogRecord p) => new
    {
        Id = p.Id,
        Name = p.Name,
        Brand = p.Brand,
        ModelNumber = p.ModelNumber,
        Category = p.Category,
        ManualUrl = p.ManualUrl,
        MsrpPrice = p.MsrpPrice,
        CreatedAt = p.CreatedAt,
        UpdatedAt = (DateTimeOffset?)null,
    };

    private async Task DispatchManualsRouteAsync(IRoute route)
    {
        var request = route.Request;
        var method = request.Method.ToUpperInvariant();
        var uri = new Uri(request.Url);
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);

        if (segments.Length < 3 || !string.Equals(segments[2], "chats", StringComparison.Ordinal))
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
            return;
        }

        var chatId = segments.Length >= 4 ? segments[3] : null;
        var isMessages = segments.Length >= 5 && string.Equals(segments[4], "messages", StringComparison.Ordinal);
        var isStream = segments.Length >= 6 && string.Equals(segments[5], "stream", StringComparison.Ordinal);

        if (chatId is null)
        {
            await HandleChatsCollectionAsync(route, method);
        }
        else if (!isMessages)
        {
            await HandleSingleChatAsync(route, method, chatId, request);
        }
        else if (!isStream)
        {
            await HandleMessagesAsync(route, method, chatId, request);
        }
        else
        {
            await HandleStreamAsync(route, chatId, request);
        }
    }

    private async Task HandleChatsCollectionAsync(IRoute route, string method)
    {
        switch (method)
        {
            case "GET":
                {
                    var chats = ChatStore.GetChats();
                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 200,
                        ContentType = "application/json",
                        Body = JsonSerializer.Serialize(chats.Select(c => new
                        {
                            chatId = c.ChatId,
                            title = c.Title,
                            createdAt = c.CreatedAt
                        }))
                    });
                    break;
                }

            case "POST":
                {
                    var chat = ChatStore.CreateChat();
                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 201,
                        ContentType = "application/json",
                        Body = JsonSerializer.Serialize(new
                        {
                            chatId = chat.ChatId,
                            title = chat.Title,
                            createdAt = chat.CreatedAt
                        })
                    });
                    break;
                }

            default:
                await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
                break;
        }
    }

    private async Task HandleSingleChatAsync(IRoute route, string method, string chatId, IRequest request)
    {
        switch (method)
        {
            case "GET":
                {
                    var chat = ChatStore.GetChat(chatId);
                    if (chat is null)
                    {
                        await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
                        return;
                    }

                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 200,
                        ContentType = "application/json",
                        Body = JsonSerializer.Serialize(new
                        {
                            chatId = chat.ChatId,
                            title = chat.Title,
                            createdAt = chat.CreatedAt
                        })
                    });
                    break;
                }

            case "PATCH":
                {
                    var body = request.PostData ?? "{}";
                    using var doc = JsonDocument.Parse(body);
                    var title = doc.RootElement.TryGetProperty("title", out var t) ? t.GetString() : null;
                    if (string.IsNullOrWhiteSpace(title))
                    {
                        await route.FulfillAsync(new RouteFulfillOptions { Status = 400 });
                        return;
                    }

                    ChatStore.UpdateTitle(chatId, title);
                    await route.FulfillAsync(new RouteFulfillOptions { Status = 204 });
                    break;
                }

            case "DELETE":
                ChatStore.DeleteChat(chatId);
                await route.FulfillAsync(new RouteFulfillOptions { Status = 204 });
                break;

            default:
                await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
                break;
        }
    }

    private async Task HandleMessagesAsync(IRoute route, string method, string chatId, IRequest request)
    {
        switch (method)
        {
            case "GET":
                {
                    var msgs = ChatStore.GetMessages(chatId);
                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 200,
                        ContentType = "application/json",
                        Body = JsonSerializer.Serialize(msgs.Select(m => new { role = m.Role, text = m.Text }))
                    });
                    break;
                }

            case "POST":
                {
                    var body = request.PostData ?? "{}";
                    using var doc = JsonDocument.Parse(body);
                    var input = doc.RootElement.TryGetProperty("input", out var i) ? (i.GetString() ?? string.Empty) : string.Empty;
                    var chat = ChatStore.CompleteMessage(chatId, input);
                    if (chat is null)
                    {
                        await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
                        return;
                    }

                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 200,
                        ContentType = "application/json",
                        Body = JsonSerializer.Serialize(new
                        {
                            output = InMemoryChatsStore.GetMockResponse(),
                            chatId = chat.ChatId
                        })
                    });
                    break;
                }

            default:
                await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
                break;
        }
    }

    private async Task DispatchProductsRouteAsync(IRoute route)
    {
        var request = route.Request;
        var method = request.Method.ToUpperInvariant();
        var uri = new Uri(request.Url);
        var path = uri.AbsolutePath;

        if (path.EndsWith("/inventory/items", StringComparison.OrdinalIgnoreCase))
        {
            await HandleInventoryItemsAsync(route, method, uri, request);
            return;
        }

        var entityKey = KeyedEntityId(path, "/odata/InventoryItems");
        if (entityKey is Guid itemId)
        {
            await HandleSingleInventoryItemAsync(route, method, itemId, request);
            return;
        }

        var catalogKey = KeyedEntityId(path, "/odata/CatalogProducts");
        if (catalogKey is Guid catalogProductId)
        {
            await HandleSingleCatalogProductAsync(route, method, catalogProductId, request);
            return;
        }

        await route.FulfillAsync(new RouteFulfillOptions { Status = 404 });
    }

    private static Guid? KeyedEntityId(string path, string setPath)
    {
        var index = path.LastIndexOf(setPath, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return null;
        }

        var remainder = path[(index + setPath.Length)..];
        if (!remainder.StartsWith('(') || !remainder.EndsWith(')'))
        {
            return null;
        }

        return Guid.TryParse(remainder[1..^1], out var id) ? id : null;
    }

    private async Task HandleInventoryItemsAsync(IRoute route, string method, Uri uri, IRequest request)
    {
        switch (method)
        {
            case "GET":
                {
                    var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
                    var search = query.TryGetValue("search", out var sv) ? sv.ToString() : null;
                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 200,
                        ContentType = "application/json",
                        Body = JsonSerializer.Serialize(
                            ProductStore.GetProducts(search).Select(InventoryItemViewToJson))
                    });
                    break;
                }

            case "POST":
                {
                    using var doc = JsonDocument.Parse(request.PostData ?? "{}");
                    var root = doc.RootElement;
                    var product = ProductStore.Create(
                        name: ReadString(root, "name"),
                        price: ReadDecimal(root, "pricePaid"),
                        brand: ReadString(root, "brand"),
                        modelNumber: ReadString(root, "modelNumber"),
                        serialNumber: ReadString(root, "serialNumber"),
                        purchaseDate: ReadString(root, "purchaseDate"),
                        category: ReadString(root, "category"),
                        description: ReadString(root, "description"),
                        manualUrl: ReadString(root, "manualUrl"),
                        msrpPrice: ReadDecimal(root, "msrpPrice"));
                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 201,
                        ContentType = "application/json",
                        Body = JsonSerializer.Serialize(InventoryItemViewToJson(product))
                    });
                    break;
                }

            default:
                await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
                break;
        }
    }

    private async Task HandleSingleInventoryItemAsync(IRoute route, string method, Guid id, IRequest request)
    {
        switch (method)
        {
            case "PATCH":
                {
                    using var doc = JsonDocument.Parse(request.PostData ?? "{}");
                    var root = doc.RootElement;
                    var updated = ProductStore.PatchItem(
                        id,
                        serialNumber: ReadString(root, "serialNumber"),
                        purchaseDate: ReadString(root, "purchaseDate"),
                        pricePaid: ReadDecimal(root, "pricePaid"),
                        description: ReadString(root, "description"));
                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = updated is null ? 404 : 204
                    });
                    break;
                }

            case "DELETE":
                await route.FulfillAsync(new RouteFulfillOptions
                {
                    Status = ProductStore.Delete(id) ? 204 : 404
                });
                break;

            default:
                await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
                break;
        }
    }

    private async Task HandleSingleCatalogProductAsync(IRoute route, string method, Guid id, IRequest request)
    {
        if (!string.Equals(method, "PATCH", StringComparison.Ordinal))
        {
            await route.FulfillAsync(new RouteFulfillOptions { Status = 405 });
            return;
        }

        using var doc = JsonDocument.Parse(request.PostData ?? "{}");
        var root = doc.RootElement;
        var updated = ProductStore.PatchCatalogProduct(
            id,
            name: ReadString(root, "name"),
            brand: ReadString(root, "brand"),
            modelNumber: ReadString(root, "modelNumber"),
            category: ReadString(root, "category"),
            manualUrl: ReadString(root, "manualUrl"),
            msrpPrice: ReadDecimal(root, "msrpPrice"));
        await route.FulfillAsync(new RouteFulfillOptions
        {
            Status = updated is null ? 404 : 204
        });
    }

    private static string? ReadString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) ? value.GetString() : null;

    private static decimal? ReadDecimal(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number
            ? value.GetDecimal()
            : null;

    private static object InventoryItemViewToJson(InMemoryProductsStore.ProductRecord p) => new
    {
        id = p.Id,
        catalogProductId = p.CatalogProductId,
        name = p.Name,
        brand = p.Brand,
        modelNumber = p.ModelNumber,
        category = p.Category,
        manualUrl = p.ManualUrl,
        msrpPrice = p.MsrpPrice,
        serialNumber = p.SerialNumber,
        purchaseDate = p.PurchaseDate,
        pricePaid = p.PricePaid,
        description = p.Description,
        createdAt = p.CreatedAt,
        updatedAt = p.UpdatedAt,
    };

    private async Task HandleStreamAsync(IRoute route, string chatId, IRequest request)
    {
        var body = request.PostData ?? "{}";
        using var doc = JsonDocument.Parse(body);
        var input = doc.RootElement.TryGetProperty("input", out var i) ? (i.GetString() ?? string.Empty) : string.Empty;
        var (_, sseBody) = ChatStore.CompleteStream(chatId, input);

        await route.FulfillAsync(new RouteFulfillOptions
        {
            Status = 200,
            ContentType = "text/event-stream",
            Body = sseBody
        });
    }

    [GeneratedRegex(@"tolower\('([^']+)'\)\s*\)", RegexOptions.IgnoreCase)]
    private static partial Regex ODataFilterRegex();
}