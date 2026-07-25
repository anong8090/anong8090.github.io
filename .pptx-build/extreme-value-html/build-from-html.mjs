import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/anong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const cwd = "/Users/anong/阿里云/Project/智能比价";
const inputHtml = path.join(cwd, "智能采购比价与合同管理系统介绍_极简价值版.html");
const buildDir = path.join(cwd, ".pptx-build/extreme-value-html");
const shotsDir = path.join(buildDir, "slides");
const finalPptx = path.join(cwd, "智能采购比价与合同管理系统介绍_极简价值版.pptx");
const slideCount = 15;
const slideSize = { width: 1920, height: 1080 };

async function captureSlides() {
  await fs.mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: slideSize,
    deviceScaleFactor: 1,
  });

  await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) => route.abort());
  await page.goto(pathToFileURL(inputHtml).href, { waitUntil: "domcontentloaded" });
  await page.emulateMedia({ media: "print" });
  await page.addStyleTag({
    content: `
      @media print {
        header, footer, .ctrl-btns, .index-drawer { display: none !important; }
        .slide { display: none !important; }
        .slide.__pptx-capture {
          display: flex !important;
          opacity: 1 !important;
          transform: none !important;
          position: relative !important;
          width: 1920px !important;
          height: 1080px !important;
          box-sizing: border-box !important;
        }
        html, body, #stage-wrapper, #presentation-stage, #presentation {
          width: 1920px !important;
          height: 1080px !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
      }
    `,
  });

  for (let i = 1; i <= slideCount; i += 1) {
    await page.evaluate((slideNum) => {
      if (window.clearAllSlideAnimations) window.clearAllSlideAnimations();
      document.querySelectorAll(".slide").forEach((slide) => {
        slide.classList.toggle("__pptx-capture", slide.id === `slide-${slideNum}`);
      });
      if (slideNum === 9 && window.renderMatDashboard) window.renderMatDashboard(0);
      if (slideNum === 10 && window.startSlide10TcoAnimation) window.startSlide10TcoAnimation();
      if (window.lucide) window.lucide.createIcons();
    }, i);
    await page.waitForTimeout(i === 10 ? 250 : 100);
    const output = path.join(shotsDir, `slide-${String(i).padStart(2, "0")}.png`);
    await page.screenshot({
      path: output,
      clip: { x: 0, y: 0, width: slideSize.width, height: slideSize.height },
      animations: "disabled",
    });
  }

  await browser.close();
}

async function buildPptx() {
  const presentation = Presentation.create({ slideSize });

  for (let i = 1; i <= slideCount; i += 1) {
    const slide = presentation.slides.add();
    slide.background.fill = "#0B0F19";
    const file = path.join(shotsDir, `slide-${String(i).padStart(2, "0")}.png`);
    const imageBytes = await fs.readFile(file);
    slide.images.add({
      blob: imageBytes,
      contentType: "image/png",
      alt: `HTML rendered slide ${i}`,
      fit: "cover",
      position: { left: 0, top: 0, width: slideSize.width, height: slideSize.height },
    });
  }

  const montage = await presentation.export({ format: "webp", montage: true, scale: 0.25 });
  await fs.writeFile(path.join(buildDir, "deck-montage.webp"), new Uint8Array(await montage.arrayBuffer()));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
}

await captureSlides();
await buildPptx();
console.log(finalPptx);
