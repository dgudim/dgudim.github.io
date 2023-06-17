window.addEventListener('DOMContentLoaded', async function () {
    const CACHE_TIMEOUT = 90000;
    async function get(url) {
        const now = new Date().getTime();
        const prevResp = JSON.parse(localStorage.getItem(url));
        if (prevResp && Math.abs(now - prevResp.time) < CACHE_TIMEOUT) {
            return prevResp.data;
        }
        const resp = await fetch(url);
        const json = await resp.json();
        localStorage.setItem(url, JSON.stringify({ time: now, data: json }));
        return json;
    }

    for (const repo_card of document.querySelectorAll('.repo_card')) {

        const repo_data = await get(`https://api.github.com/repos${repo_card.getAttribute('data-repo')}`);

        if (!repo_data.description) {
            continue;
        }

        repo_card.querySelector(".descriptionText").textContent = repo_data.description;
        repo_card.querySelector(".repo_stars .stats_text").textContent = repo_data.stargazers_count || 0;
        repo_card.querySelector(".repo_forks .stats_text").textContent = repo_data.forks_count || 0;
    }
});