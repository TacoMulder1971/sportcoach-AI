// Verkenningsscript voor de Yazio-API (onofficieel).
// Doel: kijken welke data binnenkomt zodat we het kunnen mappen naar de Voeding-tab.
//
// Gebruik (wachtwoord NIET in de code — via env vars):
//   YAZIO_EMAIL="jouw@email" YAZIO_PASSWORD="jouwwachtwoord" node scripts/yazio_explore.mjs
//
// Optioneel een datum meegeven (standaard vandaag):
//   ... node scripts/yazio_explore.mjs 2026-07-05

import { Yazio } from "yazio";
import readline from "node:readline";

// Vraag interactief om input (geen shell-quoting nodig).
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

let email = process.env.YAZIO_EMAIL;
let password = process.env.YAZIO_PASSWORD;

if (!email) email = await ask("Yazio e-mail: ");
if (!password) password = await ask("Yazio wachtwoord (zichtbaar): ");

if (!email || !password) {
  console.error("\n❌ Geen e-mail/wachtwoord ingevoerd.\n");
  process.exit(1);
}

const dateArg = process.argv[2];
const date = dateArg ? new Date(dateArg + "T12:00:00") : new Date();

const yazio = new Yazio({ credentials: { username: email, password } });

const money = (n) => (typeof n === "number" ? Math.round(n) : n);

async function main() {
  console.log(`\n🔎 Yazio-verkenning voor ${date.toISOString().slice(0, 10)}\n`);

  // 1) Gebruiker
  try {
    const user = await yazio.user.get();
    console.log("👤 Gebruiker:", { naam: user.first_name, email: user.email, sex: user.sex });
  } catch (e) {
    console.error("Kon gebruiker niet ophalen:", e.message);
    console.error("→ Login mislukt? Check email/wachtwoord en of 2FA/social-login uitstaat.");
    process.exit(1);
  }

  // 2) Dagsamenvatting: totalen + doelen + per maaltijd
  try {
    const s = await yazio.user.getDailySummary({ date });
    console.log("\n📊 Dagsamenvatting");
    console.log("   Stappen:", s.steps, "| Water (ml):", s.water_intake, "| Activiteit-kcal:", money(s.activity_energy));
    console.log("   Doelen:", {
      kcal: money(s.goals["energy.energy"]),
      koolhydraten_g: money(s.goals["nutrient.carb"]),
      eiwit_g: money(s.goals["nutrient.protein"]),
      vet_g: money(s.goals["nutrient.fat"]),
    });
    console.log("   Per maaltijd (kcal / KH / eiwit / vet):");
    for (const [meal, m] of Object.entries(s.meals)) {
      const n = m.nutrients;
      console.log(
        `     ${meal.padEnd(10)} ${String(money(n["energy.energy"])).padStart(5)} kcal  ` +
        `KH ${money(n["nutrient.carb"])}g  E ${money(n["nutrient.protein"])}g  V ${money(n["nutrient.fat"])}g`
      );
    }
  } catch (e) {
    console.error("Kon dagsamenvatting niet ophalen:", e.message);
  }

  // 3) Losse gelogde items
  try {
    const items = await yazio.user.getConsumedItems({ date });
    console.log(`\n🍽️  Gelogde items: ${items.products.length} product(en), ` +
      `${items.recipe_portions.length} recept(en), ${items.simple_products.length} snelle invoer`);
    for (const p of items.products.slice(0, 15)) {
      let name = p.product_id;
      try {
        const prod = await yazio.products.get(p.id ? p.product_id : p.product_id);
        if (prod?.name) name = prod.name;
      } catch { /* naam ophalen is best-effort */ }
      console.log(`   [${p.daytime}] ${name} — ${p.amount} ${p.serving ?? "g"}`);
    }
    if (items.products[0]) {
      console.log("\n🧬 Ruwe structuur van 1 item (voor de mapping):");
      console.log(JSON.stringify(items.products[0], null, 2));
    }
  } catch (e) {
    console.error("Kon items niet ophalen:", e.message);
  }

  console.log("\n✅ Klaar. Deel de output, dan mappen we dit naar de Voeding-tab.\n");
}

main().catch((e) => {
  console.error("Onverwachte fout:", e);
  process.exit(1);
});
