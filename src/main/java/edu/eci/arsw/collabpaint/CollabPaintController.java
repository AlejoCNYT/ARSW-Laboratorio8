package edu.eci.arsw.collabpaint;

import edu.eci.arsw.collabpaint.model.Point;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class CollabPaintController {

	@Autowired
	private SimpMessagingTemplate messagingTemplate;

	@MessageMapping("/newpoint.{drawingId}")
	public void sendPoint(@DestinationVariable String drawingId, @Payload Point point) {
		// Validación mejorada
		if (point == null || point.getX() < 0 || point.getY() < 0) {
			System.err.println("Punto inválido recibido: " + point);
			return;
		}

		System.out.printf("Punto recibido para %s: %s%n", drawingId, point);

		// Enviar a TODOS los suscriptores del tópico
		messagingTemplate.convertAndSend("/topic/newpoint." + drawingId, point);

		// Debug: Verificar suscriptores
		System.out.println("Mensaje enviado a /topic/newpoint." + drawingId);
	}
}