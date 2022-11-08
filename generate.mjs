import fs from 'fs';
import iterator from 'iterate-tree'
import makerjs from 'makerjs'
import intersection from 'array-intersection'
import { pointInSvgPath } from 'point-in-svg-path'
import intersect from 'path-intersection'

import catalog from './catalog.json' assert {type: "json"};
import groups from './groups.json' assert {type: "json"};

const printTerritories = true

let combined = []

const size = 800
const center = {
  x: 16,
  y: 142,
}


function evenGrid(cx, cy, rings, area, divisor, outputCells = false) {
  let cells = []
  let output = [];
  let last = {};
  let radialStart = {};
  let radialEnd = {};

  for (var i = 1; i <= rings + 1; i++) {
    let offset = last.a ? last.a : 0;
    let r = Math.sqrt(((area * divisor(i) + offset)) / Math.PI);
    let a = Math.PI * Math.pow(r, 2);


    if (r > 0) {
      let minR = last.r ? last.r : 0;
      let subdivisions = divisor(i);
      let n = 0;
      let lastPos = 0;
      while(n <= subdivisions) {
        let aMinR = minR ? minR : 0;
        let pos = n * (Math.PI * 2) / subdivisions;
        
        cells.push(pie(minR, r, lastPos, pos))
        
        lastPos = pos
        if (pos > Math.PI > Math.PI) {
          continue;
        }

        let startX = Math.cos(pos) * aMinR + cx;
        let startY = Math.sin(pos) * aMinR + cy;
        let endX = Math.cos(pos) * r + cx;
        let endY = Math.sin(pos) * r + cy;


        if (!radialStart[pos]) {
          radialStart[pos] = [startX, startY];
        }
        if (i > rings) {
          radialEnd[pos] = [endX, endY];
        }
        n++;
      }
      output.push(`
        <circle
          fill="none"
          r="${ r }"
          cx="${ cx }"
          cy="${ cy }"
          stroke="silver"
          stroke-width=".1"
        />
      `)
    }
    last.r = r;
    last.a = a;
  }

  if (outputCells) {
    return cells
  }

  for (let key in radialEnd) {
    output.push(`
        <line
          x1="${radialStart[key][0]}"
          y1="${radialStart[key][1]}"
          x2="${radialEnd[key][0]}"
          y2="${radialEnd[key][1]}"
          stroke="silver"
          stroke-width=".1"
        />
    `);
  }
  return output.join('');
}

let grid = evenGrid(0, 0, 24, 300, function(n) {
  let i = 0;
  let k = 1;  

  while (i < n) {  
    i = i + k;  
    k = k * 2;  
  }  
  return (k * 3);  
});


function rectangleAround(p) {
  const size = 20
  return `M${p.x},${p.y} m${size/2},${size/2} v${size} h-${size} v-${size} z`
}

function getAngle(p) {
  var dy = p.y;
  var dx = p.x;
  var theta = Math.atan2(dy, dx)
  return theta
}

function getR (p) {
  return Math.sqrt((Math.pow(p.x, 2)) + (Math.pow(p.y,2)))
}


function pie(innerR, outerR, startArc, endArc, p = {x: 0, y: 0}) {
  let first = {
    x: (Math.cos(startArc) * outerR),
    y: (Math.sin(startArc) * outerR),
  }

  let second = {
    x: (Math.cos(endArc) * outerR),
    y: (Math.sin(endArc) * outerR),
  }

  let third = {
    x: (Math.cos(endArc) * innerR),
    y: (Math.sin(endArc) * innerR),
  }

  let fourth = {
    x: (Math.cos(startArc) * innerR),
    y: (Math.sin(startArc) * innerR),
  }

  
  return `
    M${first.x},${first.y}
    A${outerR},${outerR} ${endArc} 0 1 ${second.x},${second.y}
    L${third.x},${third.y}
    A${innerR},${innerR} ${startArc} 0 0 ${fourth.x},${fourth.y}
  z`
}

function pieAround(p, depth = 26, widthMultiplyer = 6) {
  let angle = getAngle(p)
  let radius = getR(p)
  
  let width = (Math.PI / radius) * widthMultiplyer

  let innerR = radius - depth
  let outerR = radius + depth

  let first = {
    x: (Math.cos(angle - width) * outerR),
    y: (Math.sin(angle - width) * outerR),
  }

  let second = {
    x: (Math.cos(angle + width) * outerR),
    y: (Math.sin(angle + width) * outerR),
  }

  let third = {
    x: (Math.cos(angle + width) * innerR),
    y: (Math.sin(angle + width) * innerR),
  }

  let fourth = {
    x: (Math.cos(angle - width) * innerR),
    y: (Math.sin(angle - width) * innerR),
  }

  
  return `
    M${first.x},${first.y}
    A${outerR},${outerR} ${angle+width} 0 1 ${second.x},${second.y}
    L${third.x},${third.y}
    A${innerR},${innerR} ${angle-width} 0 0 ${fourth.x},${fourth.y}
  z`
}

let points = []

function circlePath(cx, cy, r) {
  var cx = cx;
  var cy = cy;
  var r = r;
  var d = [];
  var startX = Math.cos(Math.PI)*r + cx;
  var startY = Math.sin(Math.PI)*r + cy;
  var middleX = Math.cos(0)*r + cx;
  var middleY = Math.sin(0)*r + cy;

  d.push("M" + startX + "," + startY);
  d.push("A" + r + "," + r + " 0 1,0 " +  middleX + "," + middleY); // draw half a circle clockwise
  d.push("A" + r + "," + r + " 0 1,0 " +  startX + "," + startY);  // draw another half clockwise
  return  d.join(' ');
}

for (const key in groups) {
  groups[key].shape = [];

  let cells = printTerritories && groups[key]?.size != false ? evenGrid(0, 0, 42, groups?.[key]?.size?.cell ?? 100, function(n) {
    let i = 0;
    let k = 1;  

    while (i < n) {  
      i = i + k;  
      k = k * 2;  
    }  
    return (k * 3);  
  }, true) : null;

  iterator.bfs([...catalog], 'orbits', (entry) => {
    if (entry?.location?.x && !entry?.printed) {
      if (entry?.tags && intersection(groups[key].tags, entry.tags).length > 0) {
        let coordinates = {
          x: (entry.location.x) - center.x,
          y: (entry.location.y * -1) - center.y
        }
        points.push({
          coords: coordinates,
          label: entry.name,
          color: groups[key].color,
          big: intersection(entry?.tags, ['notable']).length > 0,
        })
        entry.printed = true
        if (cells != null) {
          for (let cell of cells) {
            let aura = groups?.[key]?.size?.aura ?? 8
            if (
              !groups[key].shape.includes(cell) &&
              (
                pointInSvgPath(cell, coordinates.x, coordinates.y) ||
                intersect(circlePath(coordinates.x, coordinates.y, aura), cell).length > 1)
              ) {
              groups[key].shape.push(cell)
            }
          }
        }
      }
    }
  })

}

fs.writeFileSync('localspace.svg', `
  <svg viewBox="-${size / 2} -${size / 2} ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        @font-face {
          font-family: LG;
          src: url(lg.ttf);
        }
        text {
          text-transform: uppercase;
        }
      </style>
    </defs>

    <rect x="-${size / 2}" y="-${size / 2}" width="${size}" height="${size}" fill="black" />
    <image href="arm.png" x="-${size / 2}" y="-${size / 2}" width="${size}" height="${size}" opacity=".66" />
    ${groups.map((group) => `
      <defs>
        <filter id="glow-${group.id}">
          <feFlood flood-color="${group.color}"/>
          <feComposite in2="SourceAlpha" operator="out"/>
          <feGaussianBlur stdDeviation="1" result="blur"/>
          <feComposite operator="atop" in2="SourceGraphic"/>
        </filter> 
      </defs>
      <path filter="url(#glow-${group.id})" style="mix-blend-mode: lighten;" fill="black" d="${group.shape.join(' ')}" />
    `)}
    ${points.map(point => `
      <!--
        <circle cx="${point.coords.x}" cy="${point.coords.y}" r="${point.big ? '1' : '.25'}" fill="${point.color}" ${point.big ? '' : 'opacity=".5"'} />
      -->
      ${ point?.label ? `<text
                            transform-origin="${point.coords.x} ${point.coords.y}"
                            x="${point.coords.x}"
                            y="${point.coords.y}"
                            text-anchor="middle"
                            font-size="${point.big ? 3 : 1}"
                            ${point.big ? '' : 'opacity=".75"'} fill="${point.color}"
                            font-family="LG, sans-serif">
                              ${point.label}
                            </text>
                        ` : null }
    `)}
  </svg>
`);