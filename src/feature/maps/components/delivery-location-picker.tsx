import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { getShippingLocation, type MapCoordinate } from "../location"
import { DeliveryLocationMap } from "./delivery-location-map"

interface DeliveryLocationPickerProps {
  latitude: number | null
  longitude: number | null
  onChange: (coordinate: MapCoordinate) => void
  onClear: () => void
}

/**
 * Form field wrapper around the Leaflet picker. The two coordinate fields stay
 * owned by the surrounding form so they are submitted with the address.
 */
export function DeliveryLocationPicker({
  latitude,
  longitude,
  onChange,
  onClear,
}: DeliveryLocationPickerProps) {
  const coordinate = getShippingLocation({ latitude, longitude })

  return (
    <Field>
      <FieldLabel>
        Delivery pin{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </FieldLabel>
      <FieldContent>
        <DeliveryLocationMap
          value={coordinate}
          onChange={onChange}
          onClear={onClear}
        />
      </FieldContent>
      <FieldDescription>
        Drop a pin on your delivery location so the driver can navigate straight
        to your door. You can also use your current location.
      </FieldDescription>
    </Field>
  )
}
