import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";

let browser: Browser;
let page: Page;
const github_url = "https://github.com/dgudim?tab=repositories"

console.log("Starting puppeteer");
browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

page = await browser.newPage();
console.log("Puppeteer started");

await page.goto(github_url);

console.log(`Loaded ${github_url}`);

const repos = await page.evaluate(() => {

    function normalize(text: string | null | undefined): string {
        return text?.replaceAll("\n", "").trim() || "";
    }

    return Array.from(document.querySelectorAll("#user-repositories-list li.col-12"))
        .map(elem => {
            const username_and_repo = elem.querySelector('[itemprop="name codeRepository"]')?.getAttribute("href");
            const name = username_and_repo?.split("/").pop();
            return {
                url: `https://github.com${username_and_repo}`,
                name: name,
                description: normalize(elem.querySelector('[itemprop="description"]')?.textContent),
                lang: normalize(elem.querySelector('[itemprop="programmingLanguage"]')?.textContent),
                lang_color: elem.querySelector(".repo-language-color")?.getAttribute("style")?.replace("background-color: ", ""),
                stars: parseInt(normalize(elem.querySelector(".octicon-star")?.parentElement?.textContent)) || 0,
                forks: parseInt(normalize(elem.querySelector(".octicon-repo-forked")?.parentElement?.textContent)) || 0
            }
        });
});

console.log(`Got repo list (${repos.length}), fetching readme files`);

type RepoData = {
    url: string
    description: string,
    lang: string,
    lang_color: string,
    stars: number,
    forks: number,
    full_name: string,
    icon: string | undefined,
    thumbnail: string
}

const repos_full = (await Promise.allSettled(repos.map(repo => {
    return new Promise(async (resolve, reject) => {
        const page = await browser.newPage();
        await page.goto(repo.url);
        console.log(`Loaded ${repo.url}`);
        const repo_full = await page.evaluate((repo) => {
            const project_name = document.querySelector("#user-content-title")?.textContent?.trim() || repo.name;
            return {
                url: repo.url,
                description: repo.description,
                lang: repo.lang,
                lang_color: repo.lang_color,
                stars: repo.stars,
                forks: repo.forks,
                full_name: repo.name == project_name ? project_name : `${project_name} (${repo.name})`,
                icon: document.querySelector("#user-content-icon")?.getAttribute("src"),
                thumbnail: document.querySelector("#user-content-thumb")?.getAttribute("src")
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

let htmlPage =
`<!DOCTYPE html>
<html lang="en">

	<head>
		<title>KLOUD'S github projects</title>
		<link rel="stylesheet" type="text/css" href="style.css">
		<link rel="stylesheet" type="text/css"
			href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css">
		<meta charset="utf-8">

		<link rel="shortcut icon" href="logo.png" type="image/png" radius>
	</head>

	<body>
		<main>
			<div class="flex">
				<div class="slab big">
					<span class="xlargeText center">KLOUD's projects</span>
				</div>
				<div class="slab">
					<a href="https://github.com/dgudim/" target="_blank">
						<img src="https://avatars.githubusercontent.com/u/34401005?v=4" class="avatar hov" alt="avatar">
					</a>
				</div>
			</div>
			<div class="slab big">`;

for (const repo_data of repos_full) {
    htmlPage += `
                <a href="${repo_data.url}">
                    <div class="repo_card" style="background: linear-gradient(25deg, rgb(170, 170, 170) 52%, ${repo_data.lang_color} 100%);">

                        <div class="repo_thumbnail"
                            style="background-image: url('${repo_data.thumbnail}')">
                        </div>

                        <div class="repo_card_inner">
                            <div class="repo_text_container">
                                <h2 class="titleText">${repo_data.full_name}</h2>
                                <span class="descriptionText">${repo_data.description}</span>
                            </div>
                            <div class="repo_stats">
                                <div class="repo_lang">
                                    <div class="lang_icon" style="background: ${repo_data.lang_color};"></div>
                                    <span class="lang_text">${repo_data.lang}</span>
                                </div>
                                <div class="repo_stars">
                                    <em class="fa-regular fa-star"></em>
                                    <span class="lang_text">${repo_data.stars}</span>
                                </div>
                                <div class="repo_forks">
                                    <em class="fa-solid fa-code-fork"></em>
                                    <span class="lang_text">${repo_data.forks}</span>
                                </div>
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

htmlPage += `
            </div>
        </main>
    </body>
</html>`

const file = "../index.html";

if(fs.existsSync(file)) {
    fs.unlinkSync(file);
}

fs.writeFileSync(file, htmlPage);

console.log("DONE");
process.exit(0);