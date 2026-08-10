namespace Inventory.Tests.E2E;

using Inventory.Tests.E2E.Infrastructure;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "Smoke")]
public sealed class ProductSmokeTests(PlaywrightFixture fixture)
{
    [Fact]
    public async Task Products_full_crud_lifecycle()
    {
        const string name = "Smoke Test Product";
        const string updatedName = "Smoke Test Product (Updated)";

        var (ctx, page) = await fixture.NewProductsPageAsync();
        await using (ctx)
        {
            try
            {
                await RunLifecycleAsync(page, name, updatedName);
            }
            catch (Exception ex)
            {
                throw fixture.DescribeFailure(ex);
            }
        }
    }

    private static async Task RunLifecycleAsync(IPage page, string name, string updatedName)
    {
        await page.ClickAsync("#new-product-link");
        await page.WaitForURLAsync("**/products/new");
        await page.FillAsync("#name", name);
        await page.ClickAsync("#product-form-submit");
        await page.WaitForURLAsync(url => url.Contains("/products/") && !url.Contains("/new"));

        var productId = page.Url.TrimEnd('/').Split('/').Last();

        await Assertions.Expect(page.Locator("body").First).ToContainTextAsync(name);

        await page.GotoAsync($"/products/{productId}/edit");
        await page.WaitForURLAsync($"**/products/{productId}/edit");
        var nameInput = page.Locator("#name");
        await nameInput.ClearAsync();
        await nameInput.FillAsync(updatedName);
        await page.FillAsync("#manualUrl", "https://example.com/smoke-manual.pdf");
        await page.ClickAsync("#product-form-submit");
        await page.WaitForURLAsync($"**/products/{productId}");
        await Assertions.Expect(page.Locator("body").First).ToContainTextAsync(updatedName);
        await Assertions.Expect(page.Locator("#view-manual-link")).ToBeVisibleAsync();

        await page.GotoAsync("/products");
        await page.WaitForSelectorAsync("h2:has-text('My Products')");
        await page.FillAsync("#product-search", updatedName);
        await Task.Delay(400, TestContext.Current.CancellationToken);
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        var row = page.Locator("tbody tr").Filter(new LocatorFilterOptions { HasText = updatedName });
        await Assertions.Expect(row).ToHaveCountAsync(1);

        await row.Locator("[id^='delete-product-']").ClickAsync();
        await row.Locator("[id^='confirm-delete-product-']").ClickAsync();
        await Assertions.Expect(row).ToHaveCountAsync(0);
    }
}