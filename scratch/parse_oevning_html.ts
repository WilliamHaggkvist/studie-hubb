import fs from "fs";

const html = fs.readFileSync("scratch/raw_oevning.html", "latin1");

// Let's print table contents or tr tags
const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi);
if (trMatches) {
  trMatches.forEach((tr, idx) => {
    // Strip tags roughly for display
    const cleanText = tr.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    // extract hrefs
    const hrefs: string[] = [];
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(tr)) !== null) {
      hrefs.push(match[1]);
    }
    console.log(`--- ROW ${idx} ---`);
    console.log("Text:", cleanText);
    console.log("Hrefs:", hrefs);
  });
} else {
  console.log("No <tr> matches found!");
}
