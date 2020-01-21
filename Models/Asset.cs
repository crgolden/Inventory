namespace Assets
{
    using System;
    using System.ComponentModel.DataAnnotations;
    using static System.DateTime;

    public class Asset
    {
        public Asset()
        {
            CreatedDate = CreatedDate == default ? UtcNow : CreatedDate;
        }

        public Guid Id { get; set; }

        public DateTime CreatedDate { get; set; }

        [StringLength(255)]
        public string Name { get; set; }
    }
}
