import puppeteer from "puppeteer";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import util from "util";
import { exec as ex } from "child_process";
const exec = util.promisify(ex);
import js_beautify from "js-beautify";

const github_user_url = "https://github.com/dgudim";
const github_user_repos_url = `${github_user_url}?tab=repositories`;

console.log("Starting puppeteer");
const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
console.log("Puppeteer started");

await page.goto(github_user_repos_url);
console.log(`Loaded ${github_user_repos_url}`);

function fetchRepos(
    selector: string,
    title_selector = '[itemprop="name codeRepository"]',
) {
    return page.evaluate(
        (selector, title_selector) => {
            function normalize(text: string | null | undefined): string {
                return text?.replaceAll("\n", "").trim() ?? "";
            }

            return Array.from(document.querySelectorAll(selector)).map((elem) => {
                const username_and_repo = elem
                    .querySelector(title_selector)
                    ?.getAttribute("href");
                const name = username_and_repo?.split("/").pop();
                return {
                    url: `https://github.com${username_and_repo}`,
                    username_and_repo: username_and_repo,
                    name: name,
                    description: normalize(
                        elem.querySelector('[itemprop="description"]')?.textContent,
                    ),
                    lang: normalize(
                        elem.querySelector('[itemprop="programmingLanguage"]')?.textContent,
                    ),
                    lang_color: elem
                        .querySelector(".repo-language-color")
                        ?.getAttribute("style")
                        ?.replace("background-color: ", ""),
                    stars:
                        normalize(
                            elem.querySelector(`a[href="${username_and_repo}/stargazers"]`)
                                ?.textContent,
                        ) || "0",
                    forks:
                        normalize(
                            elem.querySelector(`a[href="${username_and_repo}/forks"]`)
                                ?.textContent,
                        ) || "0",
                    org_name: "",
                    org_icon: "",
                };
            });
        },
        selector,
        title_selector,
    );
}

let repos = await fetchRepos("#user-repositories-list li.col-12");

console.log(`Got user repo list (${repos.length}), fetching orgs`);

await page.goto(github_user_url);
console.log(`Loaded ${github_user_url}`);

const orgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[itemprop="follows"]')).map(
        (elem) => {
            const orgName = elem.getAttribute("href");
            const icon_img = elem.querySelector("img");
            return {
                repos_url: `https://github.com/orgs${orgName}/repositories`,
                icon: icon_img?.src,
                name: icon_img?.alt,
            };
        },
    );
});

console.log(`Fetched ${orgs.length} orgs: `);
for (const org of orgs) {
    console.log(`Fetching ${org.name}`);
    await page.goto(org.repos_url);
    const org_repos = await fetchRepos(
        'li[id*="-list-view-node-"]',
        'a[data-testid="listitem-title-link"]',
    );
    console.log(`Fetched ${org_repos.length} repos from ${org.name}`);
    for (const org_repo of org_repos) {
        org_repo.org_name = org.name ?? "";
        org_repo.org_icon = org.icon ?? "";
    }
    repos = repos.concat(org_repos);
}

type RepoData = {
    url: string;
    username_and_repo: string;
    description: string;
    lang: string;
    lang_color: string;
    stars: string;
    forks: string;
    project_name: string;
    html_id: string;
    icon: string | undefined;
    thumbnail: string;
    org_name: string | undefined;
    org_icon: string | undefined;
};

const repo_tasks = repos.map((repo) => {
    return (async () => {
        const page = await browser.newPage();
        await page.goto(repo.url, { timeout: 0 });
        console.log(`Loaded ${repo.url}`);
        const repo_full = await page.evaluate((repo) => {
            const project_name =
                document.querySelector("#user-content-title")?.textContent?.trim() ||
                repo.name ||
                "";
            return {
                url: repo.url,
                username_and_repo: repo.username_and_repo,
                description: repo.description,
                lang: repo.lang,
                lang_color: repo.lang_color,
                stars: repo.stars,
                forks: repo.forks,
                project_name: project_name,
                html_id: project_name.toLowerCase().replaceAll(" ", "_"),
                icon: document.querySelector("#user-content-icon")?.getAttribute("src"),
                thumbnail: document
                    .querySelector("#user-content-thumb")
                    ?.getAttribute("src"),
                org_name: repo.org_name.length === 0 ? undefined : repo.org_name,
                org_icon: repo.org_icon.length === 0 ? undefined : repo.org_icon,
            } as RepoData;
        }, repo);
        await page.close();
        console.log(`Closed ${repo.url}, loaded additional data`);
        if (!repo_full.icon) {
            throw new Error("Icon is null");
        }
        return repo_full;
    })();
});

const repos_full = (await Promise.allSettled(repo_tasks))
    .filter((repo) => repo.status === "fulfilled")
    .map((repo) => (repo as PromiseFulfilledResult<RepoData>).value);

console.log(`Final repo list (${repos_full.length}), constructing page`);

for (const repo of repos_full) {
    console.log(repo);
}

let htmlPage = "";
for (const repo_data of repos_full) {
    htmlPage += `
                <a class="project-card" href="${repo_data.url}">
                    <div data-repo="${repo_data.username_and_repo}" class="repo_card" 
                    style="
                    background: 
                    linear-gradient(-90deg, transparent 0%, var(--bg-color) 20%), 
                    repeating-linear-gradient(90deg, ${repo_data.lang_color}, ${repo_data.lang_color} 2px, transparent 0, transparent 15px);
                    background-position: 5px 0;">

                        <div class="repo_card_adaptive">

                            <div class="repo_card_adaptive_thumbnail"
                                style="background-image: linear-gradient(90deg, transparent 75%, var(--bg-color) 100%), url('${repo_data.thumbnail}')">
                            </div>

                            <div class="repo_card_adaptive_inner">
                                <div class="repo_text_container">
                                    <h2>${repo_data.project_name}</h2>
                                    <p id="${repo_data.html_id}_description">${repo_data.description}</p>
                                </div>
                                <div class="repo_stats">
                                    <div class="icon_container repo_lang">
                                        <em style="color: ${repo_data.lang_color};" class="fa fa-circle"></em>
                                        <span class="stats_text">${repo_data.lang}</span>
                                    </div>
                                    <div class="icon_container repo_stars">
                                        <em class="fa fa-star-o"></em>
                                        <span class="stats_text" id="${repo_data.html_id}_stars">${repo_data.stars}</span>
                                    </div>
                                    <div class="icon_container repo_forks">
                                        <em class="fa fa-code-fork"></em>
                                        <span class="stats_text" id="${repo_data.html_id}_forks">${repo_data.forks}</span>
                                    </div>`;
    if (repo_data.org_icon) {
        htmlPage += `               <div class="icon_container repo_org">
                                        <img src="${repo_data.org_icon}" alt="org_icon">
                                        <span class="stats_text">${repo_data.org_name}</span>
                                    </div>`;
    }
    htmlPage += `               </div>
                            </div>
                        </div>

                        <div class="repo_card_small_thumbnail">
                            <img src="${repo_data.icon}"
                                alt="repo_card_small_thumbnail">
                        </div>

                    </div>
                </a>`;
}

const outFile = path.join(
    __dirname,
    "templates/parts/projects_content.html.j2",
);
const genFile = path.join(__dirname, "templates/render.py");
const scssFile = path.join(__dirname, "styles/render.sh");

if (fs.existsSync(outFile)) {
    fs.unlinkSync(outFile);
}

fs.writeFileSync(outFile, js_beautify.html(htmlPage, { indent_size: 4 }));

console.log("Template generation DONE ✅");

async function run(command: string) {
    const { stdout, stderr } = await exec(command);
    process.stdout.write(stdout);
    process.stderr.write(stderr);
}

await run(`python ${genFile}`);
await run(`bash ${scssFile}`);

process.exit(0);
