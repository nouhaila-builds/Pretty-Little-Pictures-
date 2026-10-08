const tags = {
  en: ["Generative AI", "Computer vision", "RGB to infrared", "Multimodal learning", "Data scarcity", "PyTorch"],
  fr: ["IA générative", "Vision par ordinateur", "RVB vers infrarouge", "Apprentissage multimodal", "Rareté des données", "PyTorch"]
};

const scenes = [
  ["190368.jpg", "Night street. A cyclist passes parked cars. In infrared the rider is bright, and the area behind the tree is bright where the color frame is dark.", "Rue de nuit. Un cycliste passe devant des voitures garées. En infrarouge, le cycliste est clair, et la zone derrière l’arbre est claire là où l’image couleur est sombre."],
  ["210143.jpg", "A person crosses near a car with its headlights on. In infrared the person is bright, and the headlight becomes a hot patch on the car.", "Une personne traverse près d’une voiture aux phares allumés. En infrarouge, la personne est claire, et le phare devient une tache chaude sur la voiture."],
  ["220297.jpg", "A bus fills the frame. People on the pavement and inside the windows are bright in infrared. The roof is dark in infrared and yellow under the street light in color.", "Un bus remplit l’image. Des personnes sur le trottoir et derrière les vitres sont claires en infrarouge. Le toit est sombre en infrarouge et jaune sous l’éclairage public en couleur."]
];

const fractions = [1, 0.2, 0.05, 0.01];
let lang = localStorage.getItem("plp-lang") === "fr" ? "fr" : "en";
let study = null;
let fraction = 1;

function text(node) {
  const value = node.getAttribute(lang === "fr" ? "data-fr" : "data-en");
  if (value !== null) node.textContent = value;
}

function applyLanguage() {
  document.documentElement.lang = lang;
  localStorage.setItem("plp-lang", lang);
  document.querySelectorAll("[data-en]").forEach(text);
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  });
  document.querySelector(".lang").setAttribute("aria-label", lang === "fr" ? "Langue" : "Language");
  document.getElementById("split").setAttribute("aria-label", lang === "fr" ? "Séparateur entre l’image visible et l’infrarouge réel" : "Divider between the visible image and the real infrared image");
  document.getElementById("tags").innerHTML = tags[lang].map((tag) => `<li>${tag}</li>`).join("");
  if (study) render();
}

function formatAp(value) {
  if (value === null || Number.isNaN(value)) return "—";
  if (value === 0) return "0";
  if (value < 0.001) return value.toExponential(1);
  return value.toFixed(3);
}

function asset(path) {
  return path ? path.replace(/^\//, "") : "";
}

function diffusionRows() {
  return fractions
    .map((value) => study.experiments.find((item) => item.model === "diffusion" && item.training_fraction === value))
    .filter(Boolean);
}

function num(value, digits) {
  return value === null || value === undefined ? "—" : Number(value).toFixed(digits);
}

function render() {
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const counts = study.dataset.counts;
  const intro = lang === "fr"
    ? `LLVIP est le jeu d’étude : des paires alignées visible et infrarouge lointain, surtout de nuit, avec des boîtes de piétons. ${study.dataset.citation}.`
    : `LLVIP is the study set: aligned visible and long-wave infrared pairs, mostly at night, with pedestrian boxes. ${study.dataset.citation}.`;
  document.getElementById("dataset-intro").textContent = intro;
  document.getElementById("dataset-counts").textContent = lang === "fr"
    ? `Les listes fixes contiennent ${counts.train_100.toLocaleString(locale)} paires d’entraînement, ${counts.val.toLocaleString(locale)} paires de validation et ${counts.test.toLocaleString(locale)} paires de test. La liste à 1 % contient ${counts.train_01.toLocaleString(locale)} paires.`
    : `The fixed lists contain ${counts.train_100.toLocaleString(locale)} training pairs, ${counts.val.toLocaleString(locale)} validation pairs, and ${counts.test.toLocaleString(locale)} test pairs. The 1% list contains ${counts.train_01.toLocaleString(locale)} pairs.`;

  const pair = study.experiments.find((item) => item.id === "plp-diffusion-100");
  const sample = asset(pair && pair.sample);
  document.getElementById("pane-rgb").style.backgroundImage = sample ? `url("${sample}")` : "";
  document.getElementById("pane-ir").style.backgroundImage = sample ? `url("${sample}")` : "";

  renderFraction();
  renderProtocol(locale, counts);
  renderFinding();
  renderChart();
  renderTable();
  renderFailures();
}

function renderFraction() {
  const group = document.getElementById("fractions");
  group.setAttribute("aria-label", lang === "fr" ? "Fraction des données d’entraînement" : "Training data fraction");
  group.innerHTML = fractions.map((value) => {
    const label = lang === "fr" ? `${Math.round(value * 100)} %` : `${Math.round(value * 100)}%`;
    return `<button type="button" data-fraction="${value}" aria-pressed="${fraction === value}">${label}</button>`;
  }).join("");
  const current = study.experiments.find((item) => item.model === "diffusion" && item.training_fraction === fraction);
  const host = document.getElementById("evidence");
  if (!current) {
    host.innerHTML = "";
    return;
  }
  const status = lang === "fr"
    ? ({ completed: "terminé", pending: "en attente" }[current.status] || current.status)
    : current.status.replaceAll("_", " ");
  const generated = lang === "fr" ? "Généré" : "Generated";
  const real = lang === "fr" ? "Infrarouge réel" : "Real infrared";
  const same = lang === "fr" ? "Même liste de test fixe pour chaque fraction." : "Same fixed test list for every fraction.";
  const image = asset(current.sample);
  host.innerHTML = `
    <p class="note">${current.id} · ${status} · config ${current.config}</p>
    ${image ? `<figure class="triptych"><img src="${image}" alt=""><figcaption><span>RGB</span><span>${generated}</span><span>${real}</span></figcaption></figure>` : ""}
    <div class="metrics">
      ${metric("SSIM", num(current.metrics.ssim, 3))}
      ${metric("PSNR", num(current.metrics.psnr, 2))}
      ${metric("LPIPS", num(current.metrics.lpips, 3))}
      ${metric("AP", current.metrics.ap50 === null ? "—" : formatAp(current.metrics.ap50))}
    </div>
    <p class="note">${same}</p>
    ${curve(current.training)}
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><b>${value}</b></div>`;
}

function curve(rows) {
  if (!rows || !rows.length) return "";
  const values = rows.map((row) => row.val_loss);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = { left: 16, right: 12, top: 36, bottom: 32 };
  const width = 340;
  const height = 200;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const points = values.map((value, index) => {
    const x = pad.left + (index / Math.max(values.length - 1, 1)) * plotWidth;
    const y = pad.top + (1 - (value - min) / span) * plotHeight;
    return `${x},${y}`;
  }).join(" ");
  const loss = lang === "fr" ? "Perte de validation" : "Validation loss";
  const epoch = lang === "fr" ? "Époque" : "Epoch";
  return `<svg class="curve" viewBox="0 0 ${width} ${height}" role="img" aria-label="${loss}"><text x="${pad.left}" y="18">${loss}</text><line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotHeight}"></line><line x1="${pad.left}" y1="${pad.top + plotHeight}" x2="${pad.left + plotWidth}" y2="${pad.top + plotHeight}"></line><polyline points="${points}"></polyline><text x="${pad.left + plotWidth / 2}" y="${height - 8}" text-anchor="middle">${epoch}</text></svg>`;
}

function renderProtocol(locale, counts) {
  const rows = lang === "fr"
    ? [
      ["Jeu de données", study.dataset.name],
      ["Paires d’entraînement", counts.train_100.toLocaleString(locale)],
      ["Paires de validation", counts.val.toLocaleString(locale)],
      ["Paires de test", counts.test.toLocaleString(locale)],
      ["Fractions d’entraînement", "100 %, 20 %, 5 %, 1 %"],
      ["Découpage", "Une permutation aléatoire, graine 42 ; préfixes emboîtés"],
      ["Modèle génératif", "Diffusion conditionnelle"],
      ["Référence", "U-Net L1, données d’entraînement à 100 % seulement"],
      ["Entraînement diffusion", "30 époques par fraction"],
      ["Évaluation", "PSNR, SSIM, LPIPS, AP piéton"],
      ["Détecteur", "Détecteur de piétons gelé, entraîné sur l’infrarouge réel"]
    ]
    : [
      ["Dataset", study.dataset.name],
      ["Training pairs", counts.train_100.toLocaleString(locale)],
      ["Validation pairs", counts.val.toLocaleString(locale)],
      ["Test pairs", counts.test.toLocaleString(locale)],
      ["Training fractions", "100%, 20%, 5%, 1%"],
      ["Split", "One random permutation, seed 42; nested prefixes"],
      ["Generative model", "Conditional diffusion"],
      ["Baseline", "L1 U-Net, 100% training data only"],
      ["Diffusion training", "30 epochs per fraction"],
      ["Evaluation", "PSNR, SSIM, LPIPS, pedestrian AP"],
      ["Detector", "Frozen pedestrian detector trained on real infrared"]
    ];
  document.getElementById("protocol").innerHTML = rows.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`).join("");
}

function renderFinding() {
  const rows = diffusionRows();
  const psnr = rows.map((row) => row.metrics.psnr);
  const full = rows[0].metrics;
  const scarce = rows[3].metrics;
  const monotonic = psnr.every((value, index) => index === 0 || value <= psnr[index - 1]);
  const min = Math.min(...psnr).toFixed(2);
  const max = Math.max(...psnr).toFixed(2);
  document.getElementById("finding").textContent = lang === "fr"
    ? `Sur les quatre fractions d’entraînement du diffusion, les métriques ne se dégradent pas ensemble. Le PSNR est resté entre ${min} et ${max} dB${monotonic ? "." : " et n’est pas monotone."} Le SSIM est passé de ${full.ssim.toFixed(3)} à ${scarce.ssim.toFixed(3)}, tandis que le LPIPS est passé de ${full.lpips.toFixed(3)} à ${scarce.lpips.toFixed(3)}. L’AP piéton sur les images générées est passé de ${formatAp(full.ap50)} à 100 % des données à ${formatAp(scarce.ap50)} à 1 %.`
    : `Across the four diffusion training fractions, the metrics did not degrade together. PSNR stayed between ${min} and ${max} dB${monotonic ? "." : " and was not monotonic."} SSIM decreased from ${full.ssim.toFixed(3)} to ${scarce.ssim.toFixed(3)}, while LPIPS increased from ${full.lpips.toFixed(3)} to ${scarce.lpips.toFixed(3)}. Pedestrian AP on the generated images fell from ${formatAp(full.ap50)} at 100% training data to ${formatAp(scarce.ap50)} at 1%.`;
}

function renderChart() {
  const rows = diffusionRows();
  const panels = [
    ["PSNR", rows.map((row) => row.metrics.psnr), 16, 0],
    ["SSIM", rows.map((row) => row.metrics.ssim), 0.4, 2],
    ["LPIPS", rows.map((row) => row.metrics.lpips), 1.2, 2],
    ["AP", rows.map((row) => row.metrics.ap50), 0.02, 3]
  ];
  document.getElementById("chart").innerHTML = panels.map(([label, values, max, digits]) => panel(label, values, max, digits, rows)).join("");
}

function panel(label, values, max, digits, rows) {
  const pad = { left: 32, right: 8, top: 16, bottom: 22 };
  const width = 180;
  const height = 120;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const points = values.map((value, index) => {
    const x = pad.left + (index / Math.max(values.length - 1, 1)) * plotWidth;
    const y = pad.top + (1 - Math.min(value, max) / max) * plotHeight;
    return { x, y, tick: String(Math.round(rows[index].training_fraction * 100)) };
  });
  const top = max >= 10 ? max.toFixed(0) : max.toFixed(Math.max(digits, 1));
  const marks = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="2.4"></circle><text x="${point.x}" y="${height - 6}" text-anchor="middle">${point.tick}</text>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><text x="${pad.left}" y="12">${label}</text><line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotHeight}"></line><line x1="${pad.left}" y1="${pad.top + plotHeight}" x2="${pad.left + plotWidth}" y2="${pad.top + plotHeight}"></line><text x="2" y="${pad.top + 4}">${top}</text><polyline points="${points.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>${marks}</svg>`;
}

function renderTable() {
  const unet = study.experiments.find((item) => item.id === "plp-unet-100");
  const rows = study.experiments.filter((item) => item.model === "diffusion");
  const real = lang === "fr" ? "Infrarouge réel" : "Real infrared";
  const unetLabel = lang === "fr" ? "Référence U-Net, 100 %" : "U-Net reference, 100%";
  const head = lang === "fr" ? "Images de test" : "Test images";
  const body = rows.map((item) => {
    const percent = Math.round(item.training_fraction * 100);
    const name = lang === "fr" ? `Diffusion, ${percent} %` : `Diffusion, ${percent}%`;
    return `<tr><td>${name}</td><td>${num(item.metrics.psnr, 2)}</td><td>${num(item.metrics.ssim, 3)}</td><td>${num(item.metrics.lpips, 3)}</td><td>${formatAp(item.metrics.ap50)}</td></tr>`;
  }).join("");
  document.getElementById("results").innerHTML = `<thead><tr><th>${head}</th><th>PSNR</th><th>SSIM</th><th>LPIPS</th><th>AP</th></tr></thead><tbody><tr><td>${real}</td><td>—</td><td>—</td><td>—</td><td>${formatAp(study.downstream.ap50)}</td></tr><tr><td>${unetLabel}</td><td>${num(unet.metrics.psnr, 2)}</td><td>${num(unet.metrics.ssim, 3)}</td><td>${num(unet.metrics.lpips, 3)}</td><td>—</td></tr>${body}</tbody>`;
}

function renderFailures() {
  const visible = lang === "fr" ? "visible" : "visible";
  const real = lang === "fr" ? "Infrarouge réel" : "Real infrared";
  document.getElementById("scenes").innerHTML = scenes.map(([id, en, fr]) => `
    <figure class="failure-pair">
      <img src="samples/failures/${id}" alt="">
      <figcaption><span>${id.replace(".jpg", "")} · ${visible}</span><span>${real}</span></figcaption>
      <p>${lang === "fr" ? fr : en}</p>
    </figure>
  `).join("");
  document.getElementById("ranks").innerHTML = study.experiments.filter((item) => item.highest_error && item.highest_error.length).map((experiment) => {
    const counts = new Map();
    experiment.highest_error.forEach((row) => {
      const prefix = row.sample_id.slice(0, 3);
      counts.set(prefix, (counts.get(prefix) || 0) + 1);
    });
    const [prefix, count] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
    const worst = experiment.highest_error[0];
    const percent = Math.round(experiment.training_fraction * 100);
    const model = experiment.model === "baseline"
      ? (lang === "fr" ? `U-Net, ${percent} %` : `U-Net, ${percent}%`)
      : (lang === "fr" ? `Diffusion, ${percent} %` : `Diffusion, ${percent}%`);
    const line = lang === "fr"
      ? `${model} · pire ${worst.sample_id.replace(".jpg", "")} · MAE ${Number(worst.mae).toFixed(3)} · ${count} sur ${experiment.highest_error.length} commencent par ${prefix}`
      : `${model} · worst ${worst.sample_id.replace(".jpg", "")} · MAE ${Number(worst.mae).toFixed(3)} · ${count} of ${experiment.highest_error.length} begin with ${prefix}`;
    const items = experiment.highest_error.map((row) => `<li><span>${row.sample_id.replace(".jpg", "")}</span><span>${Number(row.mae).toFixed(3)}</span></li>`).join("");
    return `<div><p class="note">${line}</p><ol>${items}</ol></div>`;
  }).join("");
}

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    lang = button.dataset.lang;
    applyLanguage();
  });
});

document.getElementById("fractions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-fraction]");
  if (!button) return;
  fraction = Number(button.dataset.fraction);
  renderFraction();
});

document.getElementById("split").addEventListener("input", (event) => {
  const value = event.target.value;
  document.getElementById("pane-ir").style.clipPath = `inset(0 0 0 ${value}%)`;
  document.getElementById("divider").style.left = `${value}%`;
});

applyLanguage();

fetch("data/experiments.json")
  .then((response) => response.json())
  .then((data) => {
    study = data;
    render();
  });
