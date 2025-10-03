export type ProductVariantLike = {
  isDefault?: boolean | null;
  default?: boolean | null;
} & Record<string, unknown>;

export type ProductWithVariantsLike<V extends ProductVariantLike = ProductVariantLike> = {
  variants?: V[] | null;
} & Record<string, unknown>;

export function getDefaultVariant<V extends ProductVariantLike>(
  product: ProductWithVariantsLike<V> | null | undefined
): V | null {
  const variants = product?.variants ?? undefined;
  if (!variants || variants.length === 0) {
    return null;
  }

  const flaggedVariant = variants.find((variant) => {
    const isDefault = variant?.isDefault ?? variant?.default;
    return Boolean(isDefault);
  });

  return flaggedVariant ?? variants[0] ?? null;
}
