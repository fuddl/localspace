import fs from 'fs';
import iterator from 'iterate-tree'
import makerjs from 'makerjs'
import intersection from 'array-intersection'
import { pointInSvgPath } from 'point-in-svg-path'

import catalog from './catalog.json' assert {type: "json"};
import groups from './groups.json' assert {type: "json"};

let combined = []

const size = 800
const center = {
  x: 16,
  y: 142,
}


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

for (const key in groups) {
  groups[key].shape = [];
  iterator.bfs([...catalog], 'orbits', (entry) => {
    if (entry?.location?.x) {

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
        if (groups[key].shape.filter(path => pointInSvgPath(path, coordinates.x, coordinates.y)).length < 1) {
          groups[key].shape.push(pieAround(coordinates, groups[key]?.size?.depth ?? 20, groups[key]?.size?.width ?? 5))
        }
      }
    }
  })

}

fs.writeFileSync('localspace.svg', `
  <svg viewBox="-${size / 2} -${size / 2} ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="-${size / 2}" y="-${size / 2}" width="${size}" height="${size}" fill="black" />
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
      <circle cx="${point.coords.x}" cy="${point.coords.y}" r="${point.big ? '1' : '.25'}" fill="${point.color}" ${point.big ? '' : 'opacity=".5"'} />
      ${ point?.label ? `<text x="${point.coords.x + 2}" y="${point.coords.y + 1}" font-size="${point.big ? 3 : 1}" ${point.big ? '' : 'opacity=".75"'} fill="${point.color}" font-family="sans-serif">${point.label}</text>` : null }
    `)}
    <circle fill="green" r="1" cx="0" cy="0" />
  </svg>
`);