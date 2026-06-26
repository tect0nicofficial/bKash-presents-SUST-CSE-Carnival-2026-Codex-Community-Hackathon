#!/bin/bash
echo "Testing Sample Cases..."
# For simplicity, we just curl the endpoint and check the status code for now,
# or we can write a node script. Let's write a quick node script.

node -e "
const fs = require('fs');
const http = require('http');

const data = JSON.parse(fs.readFileSync('resources/SUST_Preli_Sample_Cases.json', 'utf8'));

async function testCases() {
  for (const caseData of data.cases) {
    const input = caseData.input;
    const res = await fetch('http://localhost:8000/analyze-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const json = await res.json();
    console.log(\`Case \${caseData.id}: HTTP \${res.status}\`);
    if (res.status === 200) {
      if (caseData.id === 'SAMPLE-01') {
        fs.writeFileSync('sample-output.json', JSON.stringify(json, null, 2));
      }
    }
  }
}

testCases().catch(console.error);
"
