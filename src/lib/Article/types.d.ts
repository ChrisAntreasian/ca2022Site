export type Item = {
  id: number,
  title: string,
  body: string,
  logo?: string,
  link?: string,
  secondLink?: string,
  images?: ReadonlyArray<{
    small: string,
    large: string,
    id: number
  }>,
  omitFromNav?: boolean,
  
}