<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import logoSrc from '@/assets/logo.png'
import { useThemeStore } from '@/stores/themeStore'

const props = withDefaults(
  defineProps<{
    size?: number
    showText?: boolean
    textClass?: string
  }>(),
  { size: 36, showText: false, textClass: '' },
)

const theme = useThemeStore()

const imgEl = ref<HTMLImageElement | null>(null)
const recoloredDataUrl = ref<string>(logoSrc)

const computedTextClass = computed(() => {
  if (props.textClass) return props.textClass
  return 'font-bold'
})

const themeHex = computed(() => {
  switch (theme.themeId) {
    case 'default':       return '#2dd4bf'
    case 'default-light': return '#0d9488'
    case 'red-light':     return '#7F1D1D'
    case 'red-dark':      return '#DC2626'
    case 'gold-dark':     return '#FACC15'
    case 'blue-light':    return '#1E40AF'
    default:              return '#2dd4bf'
  }
})

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

const cache = new Map<string, string>()

function recolor(srcImg: HTMLImageElement, hex: string, targetSize: number): string {
  const cacheKey = `${hex}|${targetSize}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)!
  const w = targetSize
  const h = targetSize
  const cnv = document.createElement('canvas')
  cnv.width = w
  cnv.height = h
  const ctx = cnv.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(srcImg, 0, 0, w, h)
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data
  const [tr, tg, tb] = hexToRgb(hex)
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (a === 0) continue
    const sr = d[i]
    const sg = d[i + 1]
    const sb = d[i + 2]
    if (a < 240 && sr > 240 && sg > 240 && sb > 240) continue
    const bri = Math.max(sr, sg, sb) / 255
    d[i]     = Math.min(255, Math.round(tr * bri))
    d[i + 1] = Math.min(255, Math.round(tg * bri))
    d[i + 2] = Math.min(255, Math.round(tb * bri))
  }
  ctx.putImageData(imgData, 0, 0)
  const url = cnv.toDataURL('image/png')
  cache.set(cacheKey, url)
  return url
}

let srcLoaded = false

function tryRecolor() {
  if (!srcLoaded || !imgEl.value) return
  try {
    recoloredDataUrl.value = recolor(imgEl.value, themeHex.value, Math.max(128, props.size * 2))
  } catch (e) {
    recoloredDataUrl.value = logoSrc
  }
}

function onImgLoad() {
  srcLoaded = true
  tryRecolor()
}

function onImgError() {
  recoloredDataUrl.value = logoSrc
}

watch(themeHex, tryRecolor)
watch(() => props.size, tryRecolor)

onMounted(() => {
  if (imgEl.value && imgEl.value.complete && imgEl.value.naturalWidth > 0) {
    onImgLoad()
  }
})

onBeforeUnmount(() => {
  cache.clear()
})
</script>

<template>
  <span class="inline-flex items-center gap-2 shrink-0">
    <img
      ref="imgEl"
      :src="logoSrc"
      alt=""
      aria-hidden="true"
      style="position:absolute;left:-99999px;visibility:hidden;width:0;height:0"
      @load="onImgLoad"
      @error="onImgError"
    />
    <img
      :width="size"
      :height="size"
      :src="recoloredDataUrl"
      :style="{ width: `${size}px`, height: `${size}px` }"
      class="shrink-0"
      alt="PropCount"
    />
    <span
      v-if="showText"
      :class="computedTextClass"
      :style="{
        fontFamily: 'var(--font-display)',
        color: 'var(--logo-text)',
        fontSize: `${Math.round(size * 0.55)}px`,
      }"
    >
      PropCount
    </span>
  </span>
</template>
