document.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("back-to-explore-btn");
    const exploreSection = document.getElementById("explore");

    document.querySelectorAll(".snap-panel");
    function updateButtonVisibility() {

        const exploreRect = exploreSection.getBoundingClientRect();

        const exploreVisible =
            exploreRect.top <= window.innerHeight * 0.5 &&
            exploreRect.bottom >= window.innerHeight * 0.5;

        if (exploreVisible) {
            btn.classList.add("hidden-btn");
        } else {
            btn.classList.remove("hidden-btn");
        }
    }

    btn.addEventListener("click", () => {

        exploreSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    });

    window.addEventListener("scroll", updateButtonVisibility);

    updateButtonVisibility();

});