const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'studieplatser');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

function cleanText(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

function parseHTMLFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');

  // Title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const name = titleMatch ? titleMatch[1] : path.basename(filePath, '.html');

  // Properties table block
  const tableMatch = html.match(/<table class="properties">([\s\S]*?)<\/table>/i);
  const tableHtml = tableMatch ? tableMatch[1] : '';

  // Helper to extract by property name
  const getPropVal = (propName) => {
    // Regex matches <tr class="..."><th>...propName</th><td>...</td></tr>
    // We match the th first, then match everything inside the td
    const regex = new RegExp(`<tr[^>]*>\\s*<th><span[^>]*>[\\s\\S]*?<\\/span>${propName}<\\/th>\\s*<td>([\\s\\S]*?)<\\/td>\\s*<\\/tr>`, 'i');
    const match = tableHtml.match(regex);
    if (!match) return null;
    
    const valHtml = match[1];
    // Check if it's a multi-select or single select with multiple spans
    const selectRegex = /<span class="selected-value[^>]*>([\s\S]*?)<\/span>/gi;
    const spans = [];
    let spanMatch;
    while ((spanMatch = selectRegex.exec(valHtml)) !== null) {
      spans.push(cleanText(spanMatch[1]));
    }
    if (spans.length > 0) {
      return spans.join(', ');
    }
    return valHtml;
  };

  // Location (Plats)
  const platsHtml = getPropVal('Plats');
  const location = platsHtml ? cleanText(platsHtml) : 'Okänd';

  // Betyg
  const betygHtml = getPropVal('Betyg');
  const betygText = betygHtml ? cleanText(betygHtml) : '';
  const rating = (betygText.match(/⭐/g) || []).length || 3; // count stars, default 3

  // Besöksnivå
  const besokHtml = getPropVal('Besöksnivå');
  const busyLevel = (besokHtml ? cleanText(besokHtml) : 'Medel');

  // Ljudnivå
  const ljudHtml = getPropVal('Ljudnivå');
  const soundLevel = (ljudHtml ? cleanText(ljudHtml) : 'Medel');

  // Wi-Fi
  const wifiHtml = getPropVal('Wi-Fi');
  const wifi = wifiHtml ? wifiHtml.includes('checkbox-on') : false;

  // Uttag
  const uttagHtml = getPropVal('Uttag');
  const powerOutlets = uttagHtml ? cleanText(uttagHtml) : 'Saknas';

  // Pentry
  const pentryHtml = getPropVal('Pentry');
  const pentryVal = pentryHtml ? cleanText(pentryHtml).toLowerCase() : 'nej';
  const pentry = pentryVal === 'ja';

  // Öppettider
  const tiderHtml = getPropVal('Öppettider');
  const hours = tiderHtml ? cleanText(tiderHtml) : 'Kontakta info';

  // Beskrivning
  const descHtml = getPropVal('Beskrivning');
  const description = descHtml ? cleanText(descHtml) : '';

  // Mer information (multiple links possible)
  const links = [];
  const infoHtml = getPropVal('Mer information');
  if (infoHtml) {
    const linkRegex = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(infoHtml)) !== null) {
      links.push({
        text: cleanText(linkMatch[2]) || 'Länk',
        url: linkMatch[1]
      });
    }
  }

  // Id from filename
  const id = path.basename(filePath, '.html')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return {
    id,
    name,
    description,
    busyLevel,
    rating,
    soundLevel,
    links,
    pentry,
    location,
    powerOutlets,
    wifi,
    hours
  };
}

const studyPlaces = files.map(file => {
  try {
    return parseHTMLFile(path.join(dir, file));
  } catch (err) {
    console.error(`Error parsing ${file}:`, err);
    return null;
  }
}).filter(Boolean)
  .filter(p => !p.id.startsWith('ny-studieplats') && !p.id.startsWith('studieplatser'));

const outputPath = path.join(__dirname, '..', 'src', 'lib', 'study-places.json');
fs.writeFileSync(outputPath, JSON.stringify(studyPlaces, null, 2), 'utf8');
console.log(`Successfully parsed ${studyPlaces.length} files and wrote to ${outputPath}`);
