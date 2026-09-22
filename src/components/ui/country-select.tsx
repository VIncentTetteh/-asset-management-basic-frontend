import * as React from "react";
import { Select, type SelectProps } from "@/components/ui/select";
import { COUNTRIES, isCountryCode } from "@/lib/countries";

export type CountrySelectProps = Omit<SelectProps, "children"> & {
  /** Placeholder option label shown when no country is selected. */
  placeholder?: string;
  /** Lets the user pick "no country" (the placeholder), for optional fields. */
  allowEmpty?: boolean;
  /**
   * A stored value that is not an ISO code (legacy free text). It is listed so the
   * form shows it instead of a blank, flagged so the user picks a real country.
   */
  legacyValue?: string | null;
};

/**
 * ISO-3166 country picker. Renders every country as an `<option>` whose value is
 * the alpha-2 code, so the stored value drives reliable currency inference on
 * the backend. Fully compatible with react-hook-form: spread `{...register("country")}`.
 */
const CountrySelect = React.forwardRef<HTMLSelectElement, CountrySelectProps>(
  ({ placeholder = "Select country…", allowEmpty = false, legacyValue, ...props }, ref) => {
    // Only default to the empty option when the caller isn't controlling the
    // value (react-hook-form / uncontrolled). Controlled callers pass `value`,
    // and mixing `value` with `defaultValue` warns in React.
    const isControlled = props.value !== undefined;
    return (
      <Select ref={ref} {...(isControlled ? {} : { defaultValue: "" })} {...props}>
        <option value="" disabled={!allowEmpty}>
          {placeholder}
        </option>
        {legacyValue && !isCountryCode(legacyValue) ? (
          <option value={legacyValue}>{legacyValue} (not a country code: choose a country)</option>
        ) : null}
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Select>
    );
  },
);
CountrySelect.displayName = "CountrySelect";

export { CountrySelect };
