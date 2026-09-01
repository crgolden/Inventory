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
        await page.WaitForURLAsync(url => url.Contains("/products/", StringComparison.Ordinal) && !url.Contains("/new", StringComparison.Ordinal));

        var productId = page.Url.TrimEnd('/').Split('/').Last();

        await Assertions.Expect(page.Locator("#product-detail-heading")).ToHaveTextAsync(name);

        await page.GotoAsync($"/products/{productId}/edit");
        await page.WaitForURLAsync($"**/products/{productId}/edit");
        var nameInput = page.Locator("#name");
        await nameInput.ClearAsync();
        await nameInput.FillAsync(updatedName);
        await page.FillAsync("#manualUrl", "https://example.com/smoke-manual.pdf");
        await page.ClickAsync("#product-form-submit");
        await page.WaitForURLAsync($"**/products/{productId}");
        await Assertions.Expect(page.Locator("#product-detail-heading")).ToHaveTextAsync(updatedName);
        await Assertions.Expect(page.Locator("#view-manual-link")).ToBeVisibleAsync();

        await page.GotoAsync("/products");
        await page.WaitForSelectorAsync("#products-heading");
        await Assertions.Expect(page.Locator("#products-table")).ToContainTextAsync(updatedName);
        await page.RunAndWaitForResponseAsync(
            () => page.FillAsync("#product-search", updatedName),
            response => response.Url.Contains("$filter=", StringComparison.Ordinal));

        var rows = page.Locator("[id^='product-row-']");
        await Assertions.Expect(rows).ToHaveCountAsync(1);
        await Assertions.Expect(page.Locator("#product-name-0")).ToHaveTextAsync(updatedName);

        await page.ClickAsync("#delete-product-0");
        await page.ClickAsync("#confirm-delete-product-0");
        await Assertions.Expect(rows).ToHaveCountAsync(0);
    }
}