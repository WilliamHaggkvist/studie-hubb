import fs from "fs";

const filePath = "C:\\Users\\willi\\.gemini\\antigravity-ide\\brain\\5373de13-0383-4b6f-a834-167cd80a68fc\\.system_generated\\steps\\43\\content.md";

const content = fs.readFileSync(filePath, "utf-8");
console.log("=== EXERCISE FILE CONTENT START ===");
console.log(content);
console.log("=== EXERCISE FILE CONTENT END ===");
