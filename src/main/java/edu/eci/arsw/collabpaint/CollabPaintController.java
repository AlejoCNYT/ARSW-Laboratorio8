package edu.eci.arsw.collabpaint;

import edu.eci.arsw.collabpaint.model.Point;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class CollabPaintController {

	@MessageMapping("/newpoint")
	@SendTo("/topic/newpoint")
	public Point sendPoint(@Payload Point point) {
		System.out.println("Received point: " + point.getX() + ", " + point.getY());
		return point;
	}
}
