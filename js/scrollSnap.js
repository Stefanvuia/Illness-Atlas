document.addEventListener("DOMContentLoaded", () => {
    let currentIndex = 0;
    let isScrolling = false;
    let lockTimer = null;
    const nav = document.getElementById("section-nav");

    function getSections() {
        return Array.from(document.querySelectorAll(".snap-panel"))
            .filter(s => !s.classList.contains("hidden") &&
                         getComputedStyle(s).display !== "none");
    }

    // Rebuild nav dots to match currently visible sections
    let prevCount = 0;
    function rebuildNav() {
        const sections = getSections();
        if (sections.length === prevCount) return;
        prevCount = sections.length;
        nav.innerHTML = "";
        sections.forEach((s, i) => {
            const a = document.createElement("a");
            a.href = "#" + (s.id || "");
            a.addEventListener("click", (e) => {
                e.preventDefault();
                scrollToSection(i);
            });
            nav.appendChild(a);
        });
        highlightNav();
    }

    function highlightNav() {
        const dots = nav.querySelectorAll("a");
        dots.forEach((a, i) => {
            a.classList.toggle("active", i === currentIndex);
        });
    }

    function updateCurrentSection() {
        const sections = getSections();
        const mid = window.scrollY + window.innerHeight / 2;
        let best = 0, bestDist = Infinity;
        sections.forEach((s, i) => {
            const dist = Math.abs(s.offsetTop + s.offsetHeight / 2 - mid);
            if (dist < bestDist) { bestDist = dist; best = i; }
        });
        currentIndex = best;
    }

    function scrollToSection(index) {
        const sections = getSections();
        if (index < 0 || index >= sections.length) return;

        isScrolling = true;
        currentIndex = index;
        highlightNav();

        sections[index].scrollIntoView({ behavior: "smooth", block: "start" });

        setTimeout(() => {
            history.replaceState(null, null, window.location.pathname);
        }, 400);

        clearTimeout(lockTimer);
        if ("onscrollend" in window) {
            const onEnd = () => {
                isScrolling = false;
                window.removeEventListener("scrollend", onEnd);
                clearTimeout(lockTimer);
            };
            window.addEventListener("scrollend", onEnd, { once: true });
            lockTimer = setTimeout(() => {
                isScrolling = false;
                window.removeEventListener("scrollend", onEnd);
            }, 1200);
        } else {
            lockTimer = setTimeout(() => { isScrolling = false; }, 1100);
        }
    }

    // Accumulate delta to require intentional scroll gesture
    let accumulated = 0;
    const THRESHOLD = 40;

    window.addEventListener("wheel", (e) => {
        const sections = getSections();
        if (sections.length === 0) return;

        e.preventDefault();

        if (isScrolling) return;

        accumulated += e.deltaY;

        if (Math.abs(accumulated) < THRESHOLD) return;

        const direction = accumulated > 0 ? 1 : -1;
        accumulated = 0;

        updateCurrentSection();
        scrollToSection(currentIndex + direction);
    }, { passive: false });

    let resetTimer = null;
    window.addEventListener("wheel", () => {
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { accumulated = 0; }, 150);
    }, { passive: true });

    // Observe class changes on snap-panels to detect hidden/shown transitions
    const observer = new MutationObserver(() => rebuildNav());
    document.querySelectorAll(".snap-panel").forEach(el => {
        observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    });

    // Also update nav highlight on scroll
    window.addEventListener("scroll", () => {
        if (!isScrolling) {
            updateCurrentSection();
            highlightNav();
        }
    }, { passive: true });

    rebuildNav();
});
