namespace Inventory.Api.IntegrationTests
{
    using System.Collections.Generic;
    using System.Security.Claims;
    using System.Text.Encodings.Web;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Authentication;
    using Microsoft.AspNetCore.Authentication.JwtBearer;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using static System.Threading.Tasks.Task;
    using static Microsoft.AspNetCore.Authentication.AuthenticateResult;
    using static Microsoft.IdentityModel.Tokens.TokenValidationParameters;

    public class TestAuthenticationHandler : JwtBearerHandler
    {
        private readonly IEnumerable<Claim> _claims;

        public TestAuthenticationHandler(
            IEnumerable<Claim> claims,
            IOptionsMonitor<JwtBearerOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            ISystemClock clock)
            : base(options, logger, encoder, clock)
        {
            _claims = claims;
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var identity = new ClaimsIdentity(_claims, DefaultAuthenticationType);
            var user = new ClaimsPrincipal(identity);
            var props = new AuthenticationProperties();
            var ticket = new AuthenticationTicket(user, props, JwtBearerDefaults.AuthenticationScheme);
            return FromResult(Success(ticket));
        }
    }
}
