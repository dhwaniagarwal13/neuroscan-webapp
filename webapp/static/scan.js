const drop = document.getElementById("drop");
const fileInput = document.getElementById("file");
const preview = document.getElementById("preview");
const hint = document.getElementById("drop-hint");
const runBtn = document.getElementById("run");
const result = document.getElementById("result");

const viewer = document.getElementById("viewer");
const ovFile = document.getElementById("ov-file");
const ovStatus = document.getElementById("ov-status");

let selected = null;

function setState(state, text) {
  viewer.dataset.state = state;
  ovStatus.textContent = text;
}

function fileLabel(file) {
  const kb = file.size / 1024;
  return file.name + " (" + (kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : Math.round(kb) + " KB") + ")";
}

function setFile(file) {
  if (!file || !file.type.startsWith("image/")) return false;
  selected = file;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  hint.hidden = true;
  runBtn.disabled = false;
  ovFile.textContent = fileLabel(file);
  setState("ready", "Ready to analyze");
  document.querySelectorAll(".sample").forEach((b) => b.classList.remove("active"));
  return true;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(message) {
  result.replaceChildren(el("p", "error", message));
}

function showResult(data) {
  const pct = (v) => (v * 100).toFixed(1) + "%";
  const nodes = [
    el("p", "verdict", data.label),
    el("p", "conf", "Confidence " + pct(data.confidence)),
  ];
  Object.entries(data.probabilities)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, p]) => {
      const row = el("div", "bar-row" + (name === data.label ? " top" : ""));
      const label = el("div", "bar-label");
      label.append(el("span", "", name), el("span", "", pct(p)));
      const bar = el("div", "bar");
      const fill = el("span");
      fill.style.width = "0%";
      bar.append(fill);
      row.append(label, bar);
      nodes.push(row);
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct(p); }));
    });
  if (data.confidence < 0.7) {
    nodes.push(el("p", "note", "Low confidence. The model is unsure about this image, so treat the result with extra caution."));
  }
  nodes.push(el("p", "note", "Research demo only. Not a medical diagnosis."));
  result.replaceChildren(...nodes);
}

fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
);
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })
);
drop.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function analyze() {
  if (!selected) return;
  runBtn.disabled = true;
  setState("analyzing", "Analyzing");
  result.replaceChildren(el("div", "spinner"));
  const form = new FormData();
  form.append("image", selected);
  try {
    // Hold the sweep for a moment so the scan reads as a scan even when the model answers instantly.
    const [res] = await Promise.all([fetch("predict", { method: "POST", body: form }), wait(900)]);
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || "Prediction failed.");
      setState("error", "Could not analyze");
    } else {
      showResult(data);
      setState("done", data.label + " " + (data.confidence * 100).toFixed(1) + "%");
      result.scrollIntoView({ block: "nearest" });
    }
  } catch (err) {
    showError("The live demo needs the model server, which is not available here. Run webapp/run.bat on a computer with the project to try it.");
    setState("error", "Server unavailable");
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener("click", analyze);

document.querySelectorAll(".sample").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      const res = await fetch(btn.dataset.src);
      const blob = await res.blob();
      const file = new File([blob], btn.dataset.name, { type: blob.type || "image/jpeg" });
      if (setFile(file)) {
        btn.classList.add("active");
        analyze();
      }
    } catch (err) {
      showError("Could not load that sample scan. Reload the page and try again.");
    }
  });
});
