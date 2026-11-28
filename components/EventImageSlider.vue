<template>
  <div v-if="images && images.length" class="event-slider">
    <swiper
      :modules="modules"
      :slides-per-view="1"
      :loop="images.length > 1"
      :autoplay="{ delay: 4000, disableOnInteraction: false }"
      :pagination="{ clickable: true }"
      :navigation="images.length > 1"
      class="event-swiper"
      @swiper="onSwiper"
      @slideChange="onSlideChange"
    >
      <swiper-slide v-for="(img, idx) in images" :key="idx">
        <ImageAgenda :src="img" :alt="altPrefix + (idx+1)" class="event-img" :prioritaire="idx === (initialIndex || 0)"
          :date="date" :heure="heure"
          @click.stop="$emit('slideClick', idx)"
          style="cursor:pointer" />
      </swiper-slide>
    </swiper>
    <div v-if="images.length > 1" class="event-swiper-pagination">
      {{ (currentIndex || 0) + 1 }} / {{ images.length }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination, Navigation } from 'swiper/modules'
import ImageAgenda from '~/components/ImageAgenda.vue'
import 'swiper/css'
import 'swiper/css/autoplay'
import 'swiper/css/pagination'
import 'swiper/css/navigation'

const props = defineProps({
  images: { type: Array, required: true },
  altPrefix: { type: String, default: 'Image ' },
  initialIndex: { type: Number, default: 0 },
  // Séance montrée : pour une affiche automatique (voir ImageAgenda).
  date: { type: [Date, String], default: null },
  heure: { type: String, default: '' },
})

const modules = [Autoplay, Pagination, Navigation]
const currentIndex = ref(0)
const swiperInstance = ref(null)
const onSwiper = swiper => {
  swiperInstance.value = swiper
  if (props.initialIndex && swiper && swiper.slideTo) {
    swiper.slideTo(props.initialIndex, 0)
    currentIndex.value = props.initialIndex
  }
}
const onSlideChange = (e) => {
  const s = e && e.realIndex !== undefined ? e : swiperInstance.value
  if (!s) return
  currentIndex.value = typeof s.realIndex !== 'undefined' ? s.realIndex : (typeof s.activeIndex !== 'undefined' ? s.activeIndex : 0)
}
</script>

<style scoped>
.event-slider {
  width: 100%;
  max-width: 700px;
  margin: 0 auto 22px auto;
}
.event-swiper {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.11);
  background: #f5f5f5;
}
/* Cadre 16:9 réservé d'avance (ImageAgenda) : la fenêtre ne change pas de
   taille quand l'image arrive. */
.event-img {
  border-radius: 10px;
  display: block;
}
.event-swiper-pagination {
  text-align: center;
  margin-top: 4px;
  color: #118e8e;
  font-size: 15px;
  font-weight: 500;
}
@media (max-width: 600px) {
  .event-img { border-radius:8px }
  .event-slider { max-width:99vw }
}
</style>
