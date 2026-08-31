import fs from "fs";
import path from "path";

const filePath = "C:\\Users\\willi\\.gemini\\antigravity-ide\\brain\\5373de13-0383-4b6f-a834-167cd80a68fc\\.system_generated\\steps\\25\\content.md";

const content = fs.readFileSync(filePath, "utf-8");
console.log("=== FILE CONTENT START ===");
console.log(content.slice(0, 4000));
console.log("=== FILE CONTENT END ===");
