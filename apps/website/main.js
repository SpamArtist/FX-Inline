const yearElement = document.getElementById("year");
if (yearElement) {
  yearElement.textContent = new Intl.DateTimeFormat("en", {
    year: "numeric",
  }).format(new Date());
}
