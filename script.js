(function () {
    "use strict";

    /* ---------- CSV parsing ---------- */
    // Minimal RFC4180-ish CSV parser: handles quoted fields containing
    // commas, newlines and escaped ("") double quotes.
    function parseCSV(text) {
        const rows = [];
        let row = [];
        let field = "";
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const c = text[i];

            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field += c;
                }
                continue;
            }

            if (c === '"') {
                inQuotes = true;
            } else if (c === ",") {
                row.push(field);
                field = "";
            } else if (c === "\n" || c === "\r") {
                if (c === "\r" && text[i + 1] === "\n") i++;
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
            } else {
                field += c;
            }
        }
        if (field.length > 0 || row.length > 0) {
            row.push(field);
            rows.push(row);
        }

        const filtered = rows.filter((r) => !(r.length === 1 && r[0] === ""));
        const header = filtered[0];
        return filtered.slice(1).map((r) => {
            const obj = {};
            header.forEach((key, idx) => {
                obj[key.trim()] = (r[idx] !== undefined ? r[idx] : "").trim();
            });
            return obj;
        });
    }

    /* ---------- Description generation ---------- */
    function ruleLines(ruleName, rawDescription) {
        const lines = rawDescription.split("\n").map((l) => l.trim()).filter(Boolean);

        if (lines.length > 1 && lines.every((l) => l.includes(":"))) {
            // Each sub-line already carries its own label (e.g. Binary Tree).
            return lines;
        }

        const combined = lines.join(" ");
        if (combined.toLowerCase().startsWith(ruleName.toLowerCase() + ":")) {
            return [combined];
        }
        return [`${ruleName}: ${combined}`];
    }

    function buildDescription(puzzle, rulesMap) {
        const lines = [];
        puzzle.tags.forEach((tag) => {
            const ruleKey = tag === "Normal" ? "Normal Sudoku" : tag;
            const raw = rulesMap[ruleKey];
            if (!raw) return;
            lines.push(...ruleLines(ruleKey, raw));
        });
        if (puzzle.notes) {
            lines.push(puzzle.notes);
        }
        return lines;
    }

    /* ---------- Data loading ---------- */
    function loadText(path) {
        return fetch(path).then((res) => {
            if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
            return res.text();
        });
    }

    Promise.all([loadText("Rules.csv"), loadText("AllPuzzles.csv")])
        .then(([rulesText, puzzlesText]) => {
            const rulesMap = {};
            parseCSV(rulesText).forEach((row) => {
                rulesMap[row.Rule] = row.Description;
            });

            const puzzles = parseCSV(puzzlesText).map((row) => ({
                id: parseInt(row.ID, 10),
                name: row.Name,
                link: row.Link,
                tags: row.Tags.split(",").map((t) => t.trim()).filter(Boolean),
                difficulty: parseInt(row.Difficulty, 10),
                image: row.Image,
                notes: row.Notes,
            }));

            puzzles.forEach((p) => {
                p.description = buildDescription(p, rulesMap);
            });

            initUI(puzzles);
        })
        .catch((err) => {
            const list = document.getElementById("puzzle-list");
            list.textContent = "Sorry, the puzzle list could not be loaded. Please refresh the page.";
            console.error(err);
        });

    /* ---------- UI ---------- */
    function initUI(puzzles) {
        const listEl = document.getElementById("puzzle-list");
        const emptyStateEl = document.getElementById("empty-state");
        const tagFilterEl = document.getElementById("tag-filter");
        const sortSelectEl = document.getElementById("sort-select");
        const clearFiltersEl = document.getElementById("clear-filters");
        const filtersToggleEl = document.getElementById("filters-toggle");
        const filtersPanelEl = document.getElementById("filters-panel");
        const filtersCloseEl = document.getElementById("filters-close");
        const filtersCountEl = document.getElementById("filters-count");

        const allTags = Array.from(
            new Set(puzzles.flatMap((p) => p.tags).filter((t) => t !== "Normal"))
        ).sort((a, b) => a.localeCompare(b));

        const selectedTags = new Set();
        let sortMode = "newest";

        function toggleTag(tag) {
            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
            } else {
                selectedTags.add(tag);
            }
            render();
        }

        allTags.forEach((tag) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "tag-pill";
            btn.textContent = tag;
            btn.setAttribute("aria-pressed", "false");
            btn.dataset.tag = tag;
            btn.addEventListener("click", () => toggleTag(tag));
            tagFilterEl.appendChild(btn);
        });

        sortSelectEl.addEventListener("change", () => {
            sortMode = sortSelectEl.value;
            render();
        });

        clearFiltersEl.addEventListener("click", () => {
            selectedTags.clear();
            render();
        });

        function openFiltersPanel() {
            filtersPanelEl.hidden = false;
            filtersToggleEl.setAttribute("aria-expanded", "true");
        }

        function closeFiltersPanel() {
            filtersPanelEl.hidden = true;
            filtersToggleEl.setAttribute("aria-expanded", "false");
        }

        filtersToggleEl.addEventListener("click", () => {
            if (filtersPanelEl.hidden) {
                openFiltersPanel();
            } else {
                closeFiltersPanel();
            }
        });

        filtersCloseEl.addEventListener("click", closeFiltersPanel);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !filtersPanelEl.hidden) {
                closeFiltersPanel();
                filtersToggleEl.focus();
            }
        });

        function sortPuzzles(list) {
            const sorted = list.slice();
            switch (sortMode) {
                case "oldest":
                    sorted.sort((a, b) => a.id - b.id);
                    break;
                case "diff-asc":
                    sorted.sort((a, b) => a.difficulty - b.difficulty || b.id - a.id);
                    break;
                case "diff-desc":
                    sorted.sort((a, b) => b.difficulty - a.difficulty || b.id - a.id);
                    break;
                case "newest":
                default:
                    sorted.sort((a, b) => b.id - a.id);
                    break;
            }
            return sorted;
        }

        function buildDifficultyBar(difficulty) {
            const bar = document.createElement("div");
            bar.className = "difficulty-bar";
            bar.setAttribute("aria-hidden", "true");
            for (let i = 1; i <= 10; i++) {
                const seg = document.createElement("span");
                if (i <= difficulty) seg.classList.add("filled");
                bar.appendChild(seg);
            }
            return bar;
        }

        function buildCard(puzzle) {
            const card = document.createElement("article");
            card.className = "puzzle-card";
            card.id = `puzzle-${puzzle.id}`;

            const header = document.createElement("div");
            header.className = "puzzle-header";
            const title = document.createElement("h2");
            title.className = "puzzle-title";
            title.textContent = puzzle.name;
            const idLabel = document.createElement("span");
            idLabel.className = "puzzle-id";
            idLabel.textContent = `#${puzzle.id}`;
            header.appendChild(title);
            header.appendChild(idLabel);
            card.appendChild(header);

            const tagsRow = document.createElement("div");
            tagsRow.className = "puzzle-tags";
            puzzle.tags
                .filter((t) => t !== "Normal")
                .forEach((tag) => {
                    const pill = document.createElement("button");
                    pill.type = "button";
                    pill.className = "tag-pill";
                    pill.textContent = tag;
                    pill.setAttribute("aria-pressed", selectedTags.has(tag) ? "true" : "false");
                    pill.addEventListener("click", () => toggleTag(tag));
                    tagsRow.appendChild(pill);
                });
            card.appendChild(tagsRow);

            const img = document.createElement("img");
            img.className = "puzzle-image";
            img.src = `images/${puzzle.image}`;
            img.alt = `Preview of the ${puzzle.name} puzzle grid`;
            img.loading = "lazy";
            img.width = 420;
            img.height = 420;
            card.appendChild(img);

            const desc = document.createElement("div");
            desc.className = "puzzle-description";
            puzzle.description.forEach((line) => {
                const p = document.createElement("p");
                p.textContent = line;
                desc.appendChild(p);
            });
            card.appendChild(desc);

            const footer = document.createElement("div");
            footer.className = "puzzle-footer";

            const diffWrap = document.createElement("div");
            diffWrap.className = "difficulty";
            const diffText = document.createElement("span");
            diffText.textContent = `Difficulty: ${puzzle.difficulty}/10`;
            diffWrap.appendChild(diffText);
            diffWrap.appendChild(buildDifficultyBar(puzzle.difficulty));
            footer.appendChild(diffWrap);

            const link = document.createElement("a");
            link.className = "puzzle-link";
            link.href = puzzle.link;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = "Solve on SudokuPad";
            footer.appendChild(link);

            card.appendChild(footer);
            return card;
        }

        function render() {
            allTags.forEach((tag) => {
                const btn = tagFilterEl.querySelector(`[data-tag="${CSS.escape(tag)}"]`);
                if (btn) btn.setAttribute("aria-pressed", selectedTags.has(tag) ? "true" : "false");
            });

            filtersToggleEl.classList.toggle("has-active-filters", selectedTags.size > 0);
            filtersCountEl.hidden = selectedTags.size === 0;
            filtersCountEl.textContent = String(selectedTags.size);

            const filtered = puzzles.filter(
                (p) => selectedTags.size === 0 || p.tags.some((t) => selectedTags.has(t))
            );
            const sorted = sortPuzzles(filtered);

            listEl.innerHTML = "";
            sorted.forEach((p) => listEl.appendChild(buildCard(p)));

            emptyStateEl.hidden = sorted.length > 0;
        }

        render();
    }

    /* ---------- Sticky header/controls height sync ---------- */
    // Both the header and the controls bar can wrap onto extra lines on
    // narrow screens, so their heights are measured rather than hardcoded,
    // keeping the filters panel anchored directly under them.
    function syncStickyOffsets() {
        const header = document.querySelector(".site-header");
        const controls = document.querySelector(".controls");
        if (header) {
            document.documentElement.style.setProperty("--header-height", `${header.offsetHeight}px`);
        }
        if (controls) {
            document.documentElement.style.setProperty("--controls-height", `${controls.offsetHeight}px`);
        }
    }

    window.addEventListener("load", syncStickyOffsets);
    window.addEventListener("resize", syncStickyOffsets);
    syncStickyOffsets();
})();
