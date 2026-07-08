"""Browser smoke test for the in-browser YOLO CV pipeline.

Loads /cv/<matchId>, clicks Load model, waits for the button to advance to
"Reload model" (which is only rendered once InferenceSession initializes),
then screenshots the page. Verifies the WASM YOLO client boots end-to-end
against the running dev server.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

MATCH_ID = "por-esp-r16"
BASE = "http://localhost:8080"
OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)


async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        await page.goto(f"{BASE}/cv/{MATCH_ID}", wait_until="domcontentloaded")
        await page.wait_for_selector("text=In-browser YOLO player detection", timeout=10_000)
        await page.screenshot(path=str(OUT / "1_loaded.png"))

        load_btn = page.get_by_role("button", name="Load model")
        await load_btn.click()
        # Poll for the button to advance to "Reload model", which only renders
        # once the InferenceSession is ready. Model download is bandwidth-bound.
        deadline = 120
        step = 2
        ready = False
        for _ in range(deadline // step):
            await asyncio.sleep(step)
            txt = (await page.locator("button").filter(has_text="model").first.inner_text()).lower()
            if "reload" in txt:
                ready = True
                break
        await page.screenshot(path=str(OUT / "2_model_ready.png"))
        if not ready:
            print("FAILED: model never became ready")
            await browser.close()
            return 1
        print("YOLO model loaded and InferenceSession ready.")

        await browser.close()

        fatal = [
            e for e in console_errors 
            if ("onnx" in e.lower() or "wasm" in e.lower() or "inference" in e.lower())
            and "hydration" not in e.lower()
        ]
        if fatal:
            print("FATAL console errors:", fatal)
            return 1
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
