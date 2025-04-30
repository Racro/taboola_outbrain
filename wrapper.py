from pyvirtualdisplay import Display
import multiprocessing as mp
import subprocess, argparse, time, os, json, shlex

SCRIPT = 'ad-scraper.js'          # node file
SIZE   = 3                        # concurrent workers
TIMEOUT_CHECK = 120               # s to wait for Chrome cleanup

# ───────────────────────────────── worker ──────────────────────────────────
def run_scraper(url):
    """Launch ad-scraper.js for a single URL and return stdout / stderr."""
    try:
        # node ad-scraper.js <url>
        result = subprocess.run(
            ['node', SCRIPT, url],
            capture_output=True,
            text=True,
            check=True,
        )
        return (url, result.stdout, result.stderr)
    except subprocess.CalledProcessError as e:
        return (url, '', f'CalledProcessError: {e}')
    except Exception as e:
        return (url, '', f'Exception: {e}')

# ──────────────────────────────── main ─────────────────────────────────────
if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--headless', default=True, type=bool)
    args = ap.parse_args()

    # optional Xvfb wrapper
    if args.headless:
        vdisp = Display(backend='xvfb', size=(1920, 1280),
                        extra_args=['-maxclients', '2048'])
        vdisp.start()
        os.environ['DISPLAY'] = f':{vdisp.display}'

    # URLs to crawl
    with open('websites_1500.txt') as fh:
        urls = [line.strip() for line in fh][:10]   # first 10 for demo

    # ─ multiprocessing pool – one job per URL ─
    with mp.Pool(processes=SIZE) as pool:
        for url, out, err in pool.imap_unordered(run_scraper, urls):
            print(f'=== {url} ===')
            print(out)
            if err: print('stderr:', err)

    # ─ optional: wait for stray Chrome, then kill ─
    start = time.time()
    while time.time() - start < TIMEOUT_CHECK:
        try:
            n = int(subprocess.check_output(['pgrep', '-c', 'chrome']).decode() or 0)
            if n == 0:
                break
            print(f'{n} chrome processes still alive … waiting')
            time.sleep(10)
        except subprocess.CalledProcessError:
            break

    os.system('pkill chrome   || true')
    os.system('pkill chromium || true')

    if args.headless:
        vdisp.stop()

    print('✅ all done')
