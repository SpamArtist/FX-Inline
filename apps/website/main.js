const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Intl.DateTimeFormat("en", {
    year: "numeric",
  }).format(new Date());
}

const marketPrices = {
  eur: {
    starter: "approx EUR 27",
    pro: "approx EUR 92",
    business: "approx EUR 232",
  },
  gbp: {
    starter: "approx GBP 23",
    pro: "approx GBP 79",
    business: "approx GBP 199",
  },
  inr: {
    starter: "approx INR 2,415",
    pro: "approx INR 8,240",
    business: "approx INR 20,730",
  },
  jpy: {
    starter: "approx JPY 4,520",
    pro: "approx JPY 15,430",
    business: "approx JPY 38,820",
  },
};

const marketButtons = document.querySelectorAll("[data-market]");
const localPriceElements = document.querySelectorAll("[data-local-price]");

for (const button of marketButtons) {
  button.addEventListener("click", () => {
    const market = button.dataset.market;
    const prices = market ? marketPrices[market] : null;

    if (!prices) {
      return;
    }

    for (const currentButton of marketButtons) {
      currentButton.classList.toggle("is-active", currentButton === button);
    }

    for (const priceElement of localPriceElements) {
      const plan = priceElement.dataset.localPrice;

      if (plan && prices[plan]) {
        priceElement.textContent = prices[plan];
      }
    }
  });
}

const reviewButton = document.querySelector("[data-review-button]");
const reviewNote = document.querySelector("[data-review-note]");

if (reviewButton && reviewNote) {
  reviewButton.addEventListener("click", () => {
    reviewNote.textContent =
      "Submission prepared. Connect this form to the production contact workflow before launch.";
  });
}
