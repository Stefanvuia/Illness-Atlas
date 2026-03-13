document.addEventListener("DOMContentLoaded", () => {
    let currentIndex = 0;
    let isScrolling = false;

    function getSections() {
        return Array.from(document.querySelectorAll(".snap-panel"))
            .filter(section => getComputedStyle(section).display !== "none");
    }

    function updateCurrentSection() {
        const sections = getSections();
        const scrollY = window.scrollY;

        let closestIndex = 0;
        let closestDistance = Infinity;

        sections.forEach((section, i) => {
            const distance = Math.abs(section.offsetTop - scrollY);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        });

        currentIndex = closestIndex;
    }

    function scrollToSection(index) {
        const sections = getSections();
        if (index < 0 || index >= sections.length) return;

        isScrolling = true;
        currentIndex = index;

        sections[index].scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        setTimeout(() => {
            history.replaceState(null, null, window.location.pathname);
        }, 400);

        setTimeout(() => {
            isScrolling = false;
        }, 900);
    }

    window.addEventListener("wheel", (e) => {
        const sections = getSections();
        if (sections.length === 0) return;

        if (isScrolling) {
            e.preventDefault();
            return;
        }

        updateCurrentSection();

        if (e.deltaY > 0) {
            e.preventDefault();
            scrollToSection(currentIndex + 1);
        } else if (e.deltaY < 0) {
            e.preventDefault();
            scrollToSection(currentIndex - 1);
        }
    }, { passive: false });

});