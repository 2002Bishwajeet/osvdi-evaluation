export default ({ app }: any) => {
  app.config.globalProperties.$base = import.meta.env.BASE_URL
}
