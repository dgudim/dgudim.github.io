import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";
import js_beautify from "js-beautify";

let browser: Browser;
let page: Page;
const github_user_url = "https://github.com/dgudim"
const github_user_repos_url = `${github_user_url}?tab=repositories`

console.log("Starting puppeteer");
browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

page = await browser.newPage();
console.log("Puppeteer started");

await page.goto(github_user_repos_url);
console.log(`Loaded ${github_user_repos_url}`);

function fetchRepos(selector: string) {
    return page.evaluate((selector) => {

        function normalize(text: string | null | undefined): string {
            return text?.replaceAll("\n", "").trim() || "";
        }

        return Array.from(document.querySelectorAll(selector))
            .map(elem => {
                const username_and_repo = elem.querySelector('[itemprop="name codeRepository"]')?.getAttribute("href");
                const name = username_and_repo?.split("/").pop();
                return {
                    url: `https://github.com${username_and_repo}`,
                    username_and_repo: username_and_repo,
                    name: name,
                    description: normalize(elem.querySelector('[itemprop="description"]')?.textContent),
                    lang: normalize(elem.querySelector('[itemprop="programmingLanguage"]')?.textContent),
                    lang_color: elem.querySelector(".repo-language-color")?.getAttribute("style")?.replace("background-color: ", ""),
                    stars: normalize(elem.querySelector(".octicon-star")?.parentElement?.textContent) || "0",
                    forks: normalize(elem.querySelector(".octicon-repo-forked")?.parentElement?.textContent) || "0",
                    org_name: "",
                    org_icon: ""
                }
            });
    }, selector);
}

let repos = await fetchRepos("#user-repositories-list li.col-12");

console.log(`Got user repo list (${repos.length}), fetching orgs`);

await page.goto(github_user_url);
console.log(`Loaded ${github_user_url}`);

const orgs = await page.evaluate(() => {

    return Array.from(document.querySelectorAll('[itemprop="follows"]'))
        .map(elem => {
            const orgName = elem.getAttribute("href");
            const icon_img = elem.querySelector("img");
            return {
                repos_url: `https://github.com/orgs${orgName}/repositories`,
                icon: icon_img?.src,
                name: icon_img?.alt
            }
        });
});

console.log(`Fetched ${orgs.length} orgs: `);
for (let org of orgs) {
    console.log(`Fetching ${org.name}`);
    await page.goto(org.repos_url);
    const org_repos = await fetchRepos(".org-repos.repo-list .Box-row");
    console.log(`Fetched ${org_repos.length} repos from ${org.name}`);
    for (let org_repo of org_repos) {
        org_repo.org_name = org.name || "";
        org_repo.org_icon = org.icon || "";
    }
    repos = repos.concat(org_repos);
}

type RepoData = {
    url: string,
    username_and_repo: string,
    description: string,
    lang: string,
    lang_color: string,
    stars: string,
    forks: string,
    full_name: string,
    html_id: string,
    icon: string | undefined,
    thumbnail: string,
    org_name: string | undefined,
    org_icon: string | undefined
}

const repos_full = (await Promise.allSettled(repos.map(repo => {
    return new Promise(async (resolve, reject) => {
        const page = await browser.newPage();
        await page.goto(repo.url, { timeout: 0 });
        console.log(`Loaded ${repo.url}`);
        const repo_full = await page.evaluate((repo) => {
            const project_name = document.querySelector("#user-content-title")?.textContent?.trim() || repo.name;
            const full_name = (repo.name == project_name ? project_name : `${project_name} (${repo.name})`) || "";
            return {
                url: repo.url,
                username_and_repo: repo.username_and_repo,
                description: repo.description,
                lang: repo.lang,
                lang_color: repo.lang_color,
                stars: repo.stars,
                forks: repo.forks,
                full_name: full_name,
                html_id: full_name.toLowerCase().replaceAll(" ", "_"),
                icon: document.querySelector("#user-content-icon")?.getAttribute("src"),
                thumbnail: document.querySelector("#user-content-thumb")?.getAttribute("src"),
                org_name: repo.org_name.length == 0 ? undefined : repo.org_name,
                org_icon: repo.org_icon.length == 0 ? undefined : repo.org_icon
            } as RepoData;
        }, repo);
        await page.close();
        console.log(`Closed ${repo.url}, loaded additional data`);
        if (repo_full.icon) {
            resolve(repo_full);
        } else {
            reject("Icon is null");
        }
    });
}))).filter(repo => repo.status == "fulfilled").map(repo => (repo as PromiseFulfilledResult<RepoData>).value);


console.log(`Final repo list (${repos_full.length}), constructing page`);

for (const repo of repos_full) {
    console.log(repo);
}

let htmlPage = "";
for (const repo_data of repos_full) {
    htmlPage += `
                <a href="${repo_data.url}">
                    <div data-repo="${repo_data.username_and_repo}" class="repo_card" style="background: linear-gradient(25deg, rgb(170, 170, 170) 52%, ${repo_data.lang_color} 100%);">

                        <div class="repo_card_adaptive">

                            <div class="repo_thumbnail"
                                style="background-image: url('${repo_data.thumbnail}')">
                            </div>

                            <div class="repo_card_inner">
                                <div class="repo_text_container">
                                    <h2 class="titleText">${repo_data.full_name}</h2>
                                    <span class="descriptionText" id="${repo_data.html_id}_description">${repo_data.description}</span>
                                </div>
                                <div class="repo_stats">
                                    <div class="icon_container repo_lang">
                                        <div class="lang_icon" style="background: ${repo_data.lang_color};"></div>
                                        <span class="stats_text">${repo_data.lang}</span>
                                    </div>
                                    <div class="icon_container repo_stars">
                                        <em class="fa-regular fa-star"></em>
                                        <span class="stats_text" id="${repo_data.html_id}_stars">${repo_data.stars}</span>
                                    </div>
                                    <div class="icon_container repo_forks">
                                        <em class="fa-solid fa-code-fork"></em>
                                        <span class="stats_text" id="${repo_data.html_id}_forks">${repo_data.forks}</span>
                                    </div>`
    if (repo_data.org_icon) {
        htmlPage += `               <div class="icon_container repo_org">
                                        <img src="${repo_data.org_icon}" alt="org_icon">
                                        <span class="stats_text">${repo_data.org_name}</span>
                                    </div>`
    }
    htmlPage += `               </div>
                            </div>
                        </div>

                        <div class="repo_small_thumbnail">
                            <img src="${repo_data.icon}"
                                alt="repo_small_thumbnail">
                            <em class="fa-brands fa-github fa-3x hov"></em>
                        </div>

                    </div>
                </a>`;
}

const file = "templates/projects.html.j2";

if (fs.existsSync(file)) {
    fs.unlinkSync(file);
}

fs.writeFileSync(file, js_beautify.html(htmlPage, { indent_size: 4 }));

console.log("DONE");
process.exit(0);
