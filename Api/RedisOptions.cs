namespace Inventory
{
    public class RedisOptions
    {
        public string? Host { get; set; }

        public int Port { get; set; } = 6379;

        public string? Password { get; set; }
    }
}
